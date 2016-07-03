const http = require('http')
const fs = require('fs')
const configBuffer = fs.readFileSync('./config.json')
const url = require('url')
const redirects = JSON.parse(configBuffer)
const PORT = 8050

var server = http.createServer((req, res) => {
  const urlObj = url.parse(req.url)
  console.log(urlObj)
  if (redirects[urlObj.path]) {
    res.writeHead(302, {'Location': redirects[urlObj.path]})
    res.end()
  } else {
    res.writeHead(404, {'Content-Type': 'text/plain'})
    res.end('No redirect found for that URL')
  }
})

console.log(`listening on ${PORT}`)
server.listen(PORT)
