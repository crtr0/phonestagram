# Phonestagram - your very own Instagram using Twilio MMS, Node, Hapi, CamanJS, Socket.io & LevelDB

![phonestagram logo](http://twilio.com/blog/wp-content/uploads/2014/11/false.gif)

This is the code repo for a blog post on how your can use a bunch of awesome technologies to apply filters to photos on your phone, kind of like Instagram. I highly encourage you to walk through the entire [tutorial](http://twilio.com/blog/2014/11/phonestagram-fun-with-photo-filters-using-node-hapi-and-camanjs.html) to get this software up-and-running on a server of your choice.

If you have any questions or run into a problem, please feel free to file an issue. Thanks!

## Setup

You will need the following to get started:

* [Twilio MMS-enabled phone number](https://www.twilio.com/mms)
* Ubuntu VPS
* Node.js

## Installation

On your Ubuntu VPS, get the necessary binaries:

```
sudo apt-get update
sudo apt-get install libcairo2-dev libjpeg8-dev libpango1.0-dev libgif-dev build-essential g++
```

Grab the source code:

`git clone <this repo>`

Change into the directory that was created and install the necessary modules:

`npm install`

Set-up some environment variables for your Node app:

```
export TWILIO_ACCOUNT_SID=xxx
export TWILIO_AUTH_TOKEN=yyy
```

Spin-up your Node server

`node .`

Log-in to your Twilio account and edit an MMS-capable phone number. Set the Messaging Request URL to `http://yourhost:3000/message`. Click "Save".

## Test

Ok, now text message "hello" to your Twilio MMS-enabled phone number.  You'll get instructions on how to use the app and what the supported filters are. Go ahead and text the number again with the word "nostalgia" and attach a photo. You should see a flow like this:

![photo filter demo](http://twilio.com/blog/wp-content/uploads/2014/11/2014-11-07-10.52.32.png)

## Meta 

* No warranty expressed or implied.  Software is as is.
* [MIT License](http://www.opensource.org/licenses/mit-license.html)
* Made with ♥ by [Twilio](http://www.twilio.com) Seattle
