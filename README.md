# cc-music-player is gone
Its purpose was to play music from CrossCode which uses complex looping to play its music for an indefinite amount of time. However, it was basically a band-aid solution for not learning the WebAudio API, and had a system that wasn't user-friendly. So from its ashes rose the new...

# Jukebox
...

## Why replace cc-music-player?
While these two programs use completely different systems, they both ultimately achieve the same goal. I decided that it'd be better than archiving `cc-music-player` or deleting it entirely. I'll keep around the old release for historical purposes, but it won't represent the latest version. Furthermore, this is a better implementation IMO since you don't need CrossCode to use it, only to play its music.

# How To Use
1. Install Node.js if you haven't already.
2. `npm install`
3. `npm start`
4. Either download a preconfigured music pack or make your own.
5. Go to `localhost` in your browser.

# Configuration
todo
```
Simple looping is useful for when the intro is embedded into the main loop.
Complex looping is useful for when the intro is separate from the main loop.
```

# Specifications
- Two DIY configuration files, `config.json` and `custom.css`. These are left as templates for the user to modify and suit their needs, and also prevent the program from throwing errors along the way.
- 
- 
- 
- Uses Express for a simple web server in order to conveniently allow XMLHttpRequests. If you want to, you can just use the files in `src/`, delete everything else, then host the server yourself however you want.
- As for GitHub releases, there'll be a set of packs per incompatible version. Inside each zipped archive, there'll be a folder named `pack` and its contents will replace the top-level files.

## Structure
- [Class] Song - Instantiate it with a track object and it'll automatically start playing a song until it's deconstructed.
- [Object] MusicPlayer - Manages whichever song is currently playing as well as fading between songs and volume control for the currently playing song.
- 
- 
- 

class Song
class MusicPlayer (manages Song objects)