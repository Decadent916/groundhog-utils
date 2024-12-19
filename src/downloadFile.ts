const downloadFileByBlob = (blob: Blob, name: string) => {
  const downloadUrl = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.download = name
  a.href = downloadUrl
  document.body.append(a)
  a.click()
  a.remove()
  URL.revokeObjectURL(downloadUrl)
}

const downloadFileByUrl = (url: string, name: string) => {
  return new Promise<void>((resolve, reject) => {
    fetch(url)
      .then((res) => {
        if(!res.body) return reject()
        const reader = res.body.getReader()
        const chunks: Uint8Array[] = []
        function processData() {
          reader.read().then(({ done, value }) => {
            if (done) {
              const blob = new Blob(chunks)
              const exten = url.slice(Math.max(0, url.lastIndexOf('.') + 1))
              downloadFileByBlob(blob, `${name}.${exten}`)
              resolve()
              return
            }
            chunks.push(value)
            processData()
          })
        }
        processData()
      })
      .catch(() => {
        reject()
      })
  })
}