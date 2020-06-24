# cc-music-player is gone
Its purpose was to play music from CrossCode which uses complex looping to play its music for an indefinite amount of time. However, it was basically a band-aid solution for not learning the WebAudio API, and had a system that wasn't user-friendly (meaning you had to use the console or reload the game). So from its ashes rose the new...

# Jukebox
This is a standalone program that provides a GUI for playing songs with complex looping for an indefinite amount of time. I decided not to incorporate non-looping songs as there are plenty of great music players out there, the specific niche of this one is that it makes use of perfect loops, perfect for music from games.

## Why replace cc-music-player?
While these two programs use completely different systems, they both ultimately achieve the same goal. I decided that it'd be better than archiving `cc-music-player` or deleting it entirely. I'll keep around the old release for historical purposes, but it won't represent the latest version. Furthermore, this is a better implementation IMO since you don't need CrossCode to use it, you only need it to play its music if you're planning on listening to CrossCode music.

# How To Use
1. Install Node.js if you haven't already.
2. Open up a command prompt in the folder with the file `package.json`.
2. `npm install`
3. `npm start`
4. Either download a preconfigured music pack or make your own using the instructions below.
5. Go to `localhost` in your browser.

## Notes
- You can click the name of the current song that's playing (below "Now Playing") to see how long you've listened to the song. It does not take into account the time you've paused, and doesn't keep track of listening to nothing.
- You can click the countdown (to the right of "Time until next song") to reset it. Useful for when you want to listen a song a bit longer but still leave the timer running.
- If you get a `Script error`, it's most likely that `config.json` isn't formatted right. Use a JSON parser to make sure that it's working before submitting a bug report.
- Make sure to optimize your icons to fit a small screen (something around 500x340).

# Configuration
There are 7 properties your `config.json` can have, and the only required one is `tracks`:
- `defaultVolume`: An integer between 0 to 100 which is the percentage volume the program should start with. (Default: `50%`)
- `fadeDuration`: A number 0 or greater that determines how long the music will fade out for when pausing and switching songs. (Default: `5 seconds`)
- `timeBetweenSongs`: An integer 0 or greater determining how long the countdown timer will run for until the next song, if the timer is enabled. (Default: `3 minutes`)
- `startWithTimer`: A boolean determining whether the timer is automatically enabled or not. (Default: `false`)
- `defaultPlaylist`: A string determining which playlist to select if the selected playlist exists. (Default: `<empty>`)
- `playlists`: An object pairing each playlist name with an array denoting the indexes of the tracks that are allowed to play in that playlist. For example, you'd use index 0 to reference the first track, 1 to reference the second track, and so on. (Default: `<empty>`)
- `tracks`: An array of objects where each object holds track metadata (more info below). (Default: `<empty>`)

## Track Metadata
There are two types of track metadata objects with two different purposes.

1. The first type is simple looping, which is useful when the intro (if present) is embedded into the main loop.

Here, you'd load one audio file even if there's an intro. The intro plays up to 1.234 seconds where the main loop starts. The main loop cuts off at 12.345 seconds and loops back to 1.234 seconds.

```json
{
	"game": "Game Name",
	"name": "Song Name",
	"icon": "assets/icon.png",
	"path": "assets/game/main.ogg",
	"loopStart": 1.234,
	"loopEnd": 12.345
}
```

2. The second type is complex looping, which is useful when the intro (if present) is separate from the main loop.

Here, you'd have two audio files (or just one if you don't have an intro). The key difference with complex looping is that the entire intro plays, and the main loop starts at 1.234 seconds **while the intro is still playing**. The main loop then plays until 12.345 seconds where the main loop plays again **while still playing the rest of the main loop**, meaning everything after 12.345 seconds is still played.

```json
{
	"game": "Game Name",
	"name": "Song Name",
	"icon": "assets/icon.png",
	"path": "assets/game/main.ogg",
	"loopEnd": 12.345,
	"introPath": "assets/game/intro.ogg",
	"introEnd": 1.234,
	"complexLooping": true
}
```

One last thing to note, paths to icons and audio files are relative to the `src` folder. To reference `index.html`, you just use `index.html`. So the `icon` attribute in these two examples are referring to an `icon.png` inside an `assets` folder, not the `icon.png` in the same folder as `config.json`.

# Specifications
- Two DIY configuration files, `config.json` and `custom.css`. These are left as templates for the user to modify and suit their needs, and also prevent the program from throwing errors along the way.
- The `assets` directory in `src` will be ignored when using git, but I'm allowing paths (starting from the `src` folder) in `config.json` to allow further user customizability. However, `custom.css` and `config.json` will not be ignored via the `.gitignore`, so keep that in mind if you plan to contribute (unless you want to change the template).
- Try to keep everything in a self-contained object in the code. It makes it less of a headache to modify stuff.
- Uses Express for a simple web server in order to conveniently allow XMLHttpRequests. If you want to, you can just use the files in `src/`, delete everything else, then host the server yourself however you want.
- As for GitHub releases, there'll be a set of packs per incompatible version. Inside each zipped archive, there'll be a folder named `pack` and its contents will replace the top-level files.

## Structure
- [Class] `Song` - Instantiate it with a track object and it'll automatically start playing a song until it's destroyed.
- [Object] `Timer` - Manages everything related to the countdown timer to switch songs. The code for switching songs is in `App.initialization()`.
- [Object] `MusicPlayer` - Manages whichever song is currently playing as well as fading between songs and volume control for the currently playing song.
- [Object] `App` - It's the object for everything related to the document and serves as the interface to the rest of the actual program.

# Future Features (Maybe)
- A playlist manager/editor, letting you not only select playlists, but also letting you edit playlists and copy their results to paste them in your config. Docked in the upper-left hand corner. This playlist will show a menu on hover/click showing the playlist names, then hovering on a playlist will open a menu to the side letting you see which songs are in it and letting you add/remove songs.
- An ability to queue songs and shuffle playlists (but also be able to change their order once shuffled).