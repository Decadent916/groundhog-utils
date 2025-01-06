import JSZip from 'jszip';
import { message } from 'antd';

interface IFile {
  children: IFile[] | string[];
}
interface IParams {
  file: IFile;
  childrenFolderName: (file: IFile, levelIndex: number) => string;
  onProgress?: (currentLevelCount: number, allCount: number, levelIndex: number) => void;
}

const allowNewApi = window.top === window.self && 'showDirectoryPicker' in window;
let downLoadCount = 0;

const readFile = async (file: string) => {
  const fileRes = await fetch(file);
  return fileRes.blob();
};

const createFile = async (dirHandler, f: string) => {
  const fileName = f.split('/').pop();
  const blob = await readFile(f);
  const fileHandler = await dirHandler.getFileHandle(fileName, { create: true });
  const writable = await fileHandler.createWritable();
  await writable.write(blob);
  await writable.close();
};

const recursiveAddFile = async (dirHandler, { file, childrenFolderName, onProgress }: IParams, levelIndex = 0) => {
  const folderName = childrenFolderName(file, levelIndex);
  const folderHandler = await dirHandler.getDirectoryHandle(folderName, { create: true });
  if (!folderHandler) return;
  const { children = [] } = file;
  const downloadQueue = [];
  let completeCount = 0;
  children.forEach((f) => {
    if (typeof f === 'string') {
      // 子元素为文件，创建文件
      downloadQueue.push(
        createFile(folderHandler, f)
          .catch((error) => {
            console.group('文件下载失败');
            console.log('父文件夹', file);
            console.log('创建失败文件', f);
            console.log('错误原因', error);
            console.groupEnd();
          })
          .finally(() => {
            ++downLoadCount;
            ++completeCount;
            onProgress?.(completeCount, downLoadCount, levelIndex);
          }),
      );
    } else {
      // 子元素为文件夹，递归创建文件夹
      downloadQueue.push(
        recursiveAddFile(folderHandler, { file: f, childrenFolderName, onProgress }, levelIndex + 1)
          .catch((error) => {
            console.group('文件夹创建失败');
            console.log('父文件夹', file);
            console.log('创建失败文件夹', f);
            console.log('错误原因', error);
            console.groupEnd();
          })
          .finally(() => {
            ++completeCount;
            onProgress?.(completeCount, downLoadCount, levelIndex);
          }),
      );
    }
  });
  await Promise.all(downloadQueue);
};

const createFileByZip = async (zipHandler, f: string) => {
  const fileName = f.split('/').pop();
  const blob = await readFile(f);
  zipHandler.file(fileName, blob);
};

const recursiveAddFileByZip = async (zipHandler, { file, childrenFolderName, onProgress }: IParams, levelIndex = 0) => {
  const folderName = childrenFolderName(file, levelIndex);
  const folderHandler = levelIndex === 0 ? zipHandler : zipHandler.folder(folderName);
  const { children = [] } = file;
  let completeCount = 0;
  const downloadQueue = [];
  children.forEach(async (f) => {
    if (typeof f === 'string') {
      // 子元素为文件，创建文件
      downloadQueue.push(
        createFileByZip(folderHandler, f)
          .catch((error) => {
            console.group('文件下载失败');
            console.log('父文件夹', file);
            console.log('创建失败文件', f);
            console.log('错误原因', error);
            console.groupEnd();
          })
          .finally(() => {
            ++downLoadCount;
            ++completeCount;
            onProgress?.(completeCount, downLoadCount, levelIndex);
          }),
      );
    } else {
      // 子元素为文件夹，递归创建文件夹
      downloadQueue.push(
        recursiveAddFileByZip(folderHandler, { file: f, childrenFolderName, onProgress }, levelIndex + 1)
          .catch((error) => {
            console.group('文件夹创建失败');
            console.log('父文件夹', file);
            console.log('创建失败文件夹', f);
            console.log('错误原因', error);
            console.groupEnd();
          })
          .finally(() => {
            ++completeCount;
            onProgress?.(completeCount, downLoadCount, levelIndex);
          }),
      );
    }
  });
  await Promise.all(downloadQueue);
};

const zipDownload = async (params: IParams) => {
  const { file, childrenFolderName } = params;
  const zip = new JSZip();
  const zipName = childrenFolderName(file, 0);
  await recursiveAddFileByZip(zip, params);
  zip.generateAsync({ type: 'blob' }).then((blob) => {
    const a = document.createElement('a');
    const url = URL.createObjectURL(blob);
    a.href = url;
    a.download = `${zipName}.zip`;
    a.click();
    URL.revokeObjectURL(url);
  });
};

const newApiDownload = async (params: IParams) => {
  const dirHandler = await window.showDirectoryPicker({ mode: 'readwrite' }).catch((error) => {
    console.log('权限获取失败', error);
    message.error('权限被拒绝，下载失败');
  });
  await recursiveAddFile(dirHandler, params);
};

/**
 * 批量下载文件
 * 支持浏览器文件夹下载就采用文件夹下载，不支持就采用压缩包文件下载
 * @param params
 */
export const downloadFiles = (params: IParams) => {
  downLoadCount = 0;
  if (!allowNewApi) {
    return zipDownload(params);
  }
  return newApiDownload(params);
};


// 使用示例
const file = {
  folderName: '文件夹1',
  children: [
    {
      folderName: '一级文件夹1',
      children: [
        {
          folderName: '二级文件夹1-1',
          children: ['文件1地址', '文件2地址']
        }
      ]
    },
    {
      folderName: '一级文件夹2',
      children: [
        {
          folderName: '二级文件夹2-1',
          children: ['文件1地址', '文件2地址']
        }
      ]
    },
    '文件地址3'
  ]
}
downloadFiles({
  file,
  childrenFolderName: (folder, levelIndex) => folder.folderName,
  onProgress: (currentLevelCount, allCount, levelIndex) => {
    if (levelIndex === 0) {
      console.log(`完成进度：${currentLevelCount}/${file.children.length},文件总下载数：${allCount}`)
    }
  }
})