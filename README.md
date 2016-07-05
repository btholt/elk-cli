# What is elk?

elk is a command line tool that allows you to deploy your own URL shortening service (like [bit.ly](https://bit.ly)). All you have to do is `elk add /twitter https://twitter.com/holtbt` and within seconds that URL on your domain will start forwarding.

# How does it work?

elk is built on top of Zeit's [now](https://zeit.co/now) and [zeit.world](https://zeit.world) services. If you've never used these services, they're amazing and fantastic. now allows you to deploy node servers by simply typing `now` into the CLI of the directoy you want to deploy. Within seconds your node server is out in the wild and publically available (they give you a URL to access it.) zeit.world is DNS configuration service. By typing `now alias <your deployed now URL> <your own URL>` your own domain will now be point at that deployed service (after you've pointed your domain's nameservers at Zeit's.) Be forewarned though that this feature that elk exploits is part of their paid tier (something they well deserve.) elk will still work without the paid tier; you just don't get custom domain support.

# How do I get elk working?

1. If you haven't, [set up now](https://zeit.co/now#get-started)
1. If you want custom domain support, [set up zeit.world](https://zeit.co/world) on your domain.
1. `npm install --global elk-cli`
1. `elk defaultAlias example.com` (or whatever your custom domain is; you can skip this if you're not doing a custom domain)
1. `elk add /github https://github.com/btholt/elk`
1. Go to the URL (in this case https://example.com/github) and see it be redirected!

# Commands

## `elk add <path> <url> <options>`

Add a new redirect to your server. Deploys to now by default and aliases if a defaultAlias has been set. `<path>` is whatever the node requests receive as the path. Therefore `/` is the base URL as well as `/example`, `/example?`, and `/example?other=1` are all different.

## `elk remove <path>`

Remove a redirect from your server. Deploys to now by default and aliases if a defaultAlias has been set.

## `elk list`

Lists defaultAlias and currently configured redirects

## `elk defaultAlias <alias>`

Displays current defaultAlias if no alias is provided. If alias is provided, it sets it as the new defaultAlias. The alias can be anything that the `now alias` command understands. [See their docs](https://zeit.co/world#2.-alias-your-deployments).

# Options

## `-w` or `--wait`

For add and remove, this will add or remove a redirect without deploying. Useful if you add a bunch of redirects but don't want to deploy until the end

## `-a <alias>` or `--alias <alias>`

This will override whatever the defaultAlias is and set this to the alias after it deploys. The alias can be anything that the `now alias` command understands. [See their docs](https://zeit.co/world#2.-alias-your-deployments).

## `-d` or `--debug`

See the output from `now` and `now alias`

## `-n` or `--no-alias`

Don't run the aliasing step

# Contribute

Yes please!

# License

MIT
