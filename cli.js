#!/usr/bin/env node
'use strict'
const meow = require('meow')
const fs = require('fs-extra')
const path = require('path')
const spawn = require('child_process').spawn
const hasbin = require('hasbin')
const chalk = require('chalk')
const columnify = require('columnify')
const tmp = require('tmp')
const pify = require('pify')
const Spinner = require('cli-spinner').Spinner
const copy = pify(fs.copy)
const writeJson = pify(fs.writeJson)
tmp.setGracefulCleanup()
const help = `
  Usage
    $ elk <command> [...]

  Commands
    add <server path> <URL> [...]  add a new redirect to a URL
    remove <server path> [...]     remove a redirect
    list                           list all current redirects
    deploy                         deploys to now

  Options
    --wait, -w                     commit command but wait to publish
                                   useful if you are doing multiple commands at once
    --alias, -a <alias>            the alias for zeit's now
    --no-alias, -n                 do not run the alias step
    --debug, -d                    enable debug output
`
const cli = meow({help}, {alias: {
  w: 'wait',
  a: 'alias',
  d: 'debug',
  n: 'no-alias'
}})
const Configstore = require('configstore')
const config = new Configstore(cli.pkg.name, {urls: {}, defaultAlias: ''})
const redirects = config.get('urls')
const configAlias = config.get('defaultAlias')
const NOW_URL_REGEX = /https:\/\/\S*\.now\.sh/

const domainAlias = (cli.flags.alias) ? cli.flags.alias : configAlias
const noAlias = cli.flags.noAlias || !domainAlias
const debug = cli.flags.debug
const wait = cli.flags.wait

if (debug) {
  console.log(chalk.gray('minimist flags', JSON.stringify(cli.flags, null, 0)))
}

const helpers = {
  spin (promise, label, finishMessage) {
    if (!debug) {
      const spinner = new Spinner(label)
      spinner.setSpinnerString(18)
      spinner.start()
      promise.then(() => {
        spinner.stop(true)
        console.log(finishMessage)
      })
      .catch(() => spinner.stop())
    }
  },
  pullURL (output) {
    const matches = output.match(NOW_URL_REGEX)
    if (matches && matches.length > 0) {
      return matches[0]
    }
    return null
  },
  getNowUID (url) {
    return url.slice(8, -7)
  },
  deploy () {
    if (!hasbin.sync('now')) {
      console.error(chalk.red('You must install now (zeit.co/now) to deploy'))
      console.log(chalk.grey('npm install -g now'))

      process.exit(1)
    }
    return helpers.prepDeployFolder().then((tmpPath) => {
      return new Promise((resolve, reject) => {
        const oldCwd = process.cwd()
        process.chdir(tmpPath)
        let result = ''
        const now = spawn('now', ['-C'], {
          stdio: 'pipe',
          uid: process.getuid()
        })

        now.stdout.on('data', (line) => {
          const newLine = `${line}`
          result += newLine
          if (debug) {
            console.log(chalk.gray(newLine))
          }
        })

        now.on('exit', () => {
          process.chdir(oldCwd)
          const url = helpers.pullURL(result)
          if (!url) {
            return resolve()
          }
          const uid = helpers.getNowUID(url)
          resolve(uid)
        })

        process.on('SIGINT', () => {
          now.kill('SIGINT')
          reject('SIGINT')
          console.log(chalk.red('deploy aborted'))
        })
      })
    }).catch((err) => { throw err })
  },
  alias (domain, uid) {
    return new Promise((resolve, reject) => {
      const stdio = debug ? 'inherit' : 'ignore'
      const now = spawn('now', ['alias', uid, domain], {stdio})

      now.on('exit', () => {
        resolve()
      })

      process.on('SIGINT', () => {
        now.kill('SIGINT')
        reject('SIGINT')
        console.log(chalk.red('alias aborted'))
      })
    })
  },
  prepDeployFolder () {
    return new Promise((resolve, reject) => {
      tmp.dir({prefix: 'elk-', unsafeCleanup: false}, (err, tmpPath, cleanUpCallback) => {
        if (err) {
          return reject(err)
        }
        Promise.all([
          copy(__dirname + '/deployPackage.json', path.resolve(tmpPath, 'package.json')),
          writeJson(path.resolve(tmpPath, 'config.json'), redirects),
          copy(__dirname + '/index.js', path.resolve(tmpPath, 'index.js'))
        ])
        .then(() => resolve(tmpPath))
        .catch(reject)
      })
    })
  },
  orchestrateDeploy () {
    if (wait) {
      console.log(chalk.yellow('not deploying'))
      return
    }
    const deployPromise = helpers.deploy()
    helpers.spin(deployPromise, 'deploying', chalk.green('deploy complete!'))
    deployPromise.then((uid) => {
      if (!uid) {
        return console.log(chalk.red('couldn\'t find now identifier. not aliasing'))
      }

      if (noAlias) {
        console.log(chalk.yellow('not aliasing'))
        return
      }

      const aliasPromise = helpers.alias(domainAlias, uid)
      const destination = (domainAlias.indexOf('.') >= 0) ? domainAlias : `https://${domainAlias}.now.sh`
      helpers.spin(aliasPromise, 'aliasing', chalk.green(`successfully aliased ${uid} to ${destination}`))
      return aliasPromise
    }).catch((err) => {
      console.log(chalk.red('error', err))
      throw err
    })
  }
}

const commands = {
  add (path, url) {
    if (!path || !url) {
      console.log(chalk.red('you need both a path and a url eg `elk add /twitter https://twitter.com`'))
      process.exit(1)
    }
    if (path.charAt(0) !== '/') {
      path = '/' + path
    }
    redirects[path] = url
    config.set('urls', redirects)
    console.log(chalk.green(`added redirect from ${path} to ${url}`))
    helpers.orchestrateDeploy()
  },
  remove (path) {
    if (!path) {
      console.log(chalk.red('you need a path to remove eg `elk remove /twitter`'))
      process.exit(1)
    }
    if (path.charAt(0) !== '/') {
      path = '/' + path
    }
    delete redirects[path]
    config.set('urls', redirects)
    console.log(chalk.green(`removed redirect for ${path}`))
    helpers.orchestrateDeploy()
  },
  list () {
    if (configAlias) {
      this.defaultAlias()
    }
    console.log(columnify(redirects, {minWidth: 20, columns: ['incoming path', 'redirects to']}))
  },
  defaultAlias (alias) {
    if (!alias) {
      if (configAlias) {
        console.log(chalk.green('current default alias:'), configAlias)
      } else {
        console.log('no default alias set')
      }
    } else {
      config.set('defaultAlias', alias)
      console.log(chalk.green(`set ${alias} as your default alias`))
    }
  }
}

const command = cli.input[0]
if (!command) {
  cli.showHelp()
} else if (commands[command]) {
  commands[command].apply(commands, cli.input.slice(1))
} else {
  console.log(chalk.red(`${command} is not a valid command`))
  process.exit(1)
}
