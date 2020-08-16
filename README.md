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
- You can set your selected playlist to blank to randomly play any song rather than just the ones selected in the currently selected playlist.
- If you're using Google Chrome or another browser that supports the Media Session API, the jukebox will work with it to let you control the music from any tab.
- If you get a `Script error`, it's most likely that `config.json` isn't formatted right. Use a JSON parser to make sure that it's working before submitting a bug report.
- Make sure to optimize your icons to fit a small screen (something around 500x340).

# Configuration
There are 8 properties your `config.json` can have, and the only required one is `tracks`:
- `defaultVolume`: An integer between 0 to 100 which is the percentage volume the program should start with. (Default: `50%`)
- `fadeDuration`: A number 0 or greater that determines how long the music will fade out for when pausing and switching songs. (Default: `5 seconds`)
- `timeBetweenSongs`: An integer 0 or greater determining how long the countdown timer will run for until the next song, if the timer is enabled. (Default: `3 minutes`)
- `startWithTimer`: A boolean determining whether the timer is automatically enabled or not. (Default: `false`)
- `defaultPlaylist`: A string determining which playlist to select if the selected playlist exists. (Default: `<empty>`)
- `playlists`: An object pairing each playlist name with an array denoting the indexes of the tracks that are allowed to play in that playlist. For example, you'd use index 0 to reference the first track, 1 to reference the second track, and so on. (Default: `<empty>`)
- `displayFormat`: A string representing that format that should be used to display the game and name together. `$game` and `$name` gets the "game" and "name" tags on the selected track respectively. To make an actual dollar sign, use `$$`. (Default: `"$game - $name"`, Recommended format for use with custom CSS (it's a rainbow tag by default): `"<span class=\"tag\">$game</span> $name"`)
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
- There were quite a few points to consider when making the fading system.
	- To make my life much much easier, I use two `gainNode`s: One for the volume which the user will always be able to control, and the other for fading which will only be affected by pausing and switching songs. Since the two are multiplied together, you don't have to mess with complicated volume locks or multiplying the values yourself based on an interval. It just works, and much better than if I were to do it manually.
	- There's a timeout ID per song, because after the fade duration passes, a timeout function will be called to suspend or resume the context. However, if you're going to be cancelling the pause, then you'd want to cancel the context suspend as well.
	- Pausing and resuming is pretty simple when it's all during a song.
		- Pausing will cancel all ongoing fades, then fade out and pause after the fade duration passes.
		- Resuming will cancel all ongoing fades, then fade in and resume the music at the same time.
	- Switching songs is when things get complicated.
	- Firstly, switching to another song will make the music fade out for the fade duration. Fading out is a one time action though, and will not be repeated by switching to another song afterward.
	- Secondly, to support switching between multiple songs, there'll be a delay that'll occur (same as the fade duration) **but will be reset every time you switch songs during that time frame**. So you can keep clicking next until you find one that suits you.
	- Here's what happens when you switch a song while the music is pausing/resuming.
		- Switching songs while the music is pausing will skip the fade out and set the delay.
		- Switching songs while the music is resuming will cancel that fade in, begin fading out, then set the delay.
		- Switching songs while the music is paused will immediately go to the next song, skipping the delay.
	- Now for a moment, disregard manually switching to another song and just focus on the specifics of what happens when the timer counts down. The countdown activates its fade out and delay for the length of the fade duration before 0 seconds.
		- If everything remains the same, both the fade out and delay are activated.
		- If the music is paused during this time, the fade out continues but the delay is cancelled.
		- If the music is then resumed after being paused, then one of two things will happen.
			- If the countdown is less than the fade duration, the music fades back in briefly and the delay is set.
			- If the countdown is greater than the fade duration (by resetting the timer), the music fades back in and the delay is skipped.
		- If the timer is disabled or reset during this time, then it acts as a resume action, with the music fading back in and the delay being cancelled.
	- So there are a few extra steps to consider when switching songs while the countdown is activating the transition automatically.
		- Since the fade out is already taken care of by the countdown, just set a delay.
		- Pausing and then switching will continue with the existing fade out and reset the existing delay.
		- Resuming and then switching should be taken care of as part of the countdown's fade out and delay.

## Structure
- [Class] `Song` - Instantiate it with a track object and it'll automatically start playing a song until it's destroyed.
- [Object] `Timer` - Manages everything related to the countdown timer to switch songs.
- [Object] `MusicPlayer` - Manages whichever song is currently playing as well as fading between songs and volume control for the currently playing song.
- [Object] `App` - It's the object for everything related to the document and serves as the interface to the rest of the actual program.

# Future Features (Maybe)
- A fading out system when switching songs as described in the specifications.
- A playlist manager/editor, letting you not only select playlists, but also letting you edit playlists and copy their results to paste them in your config. Docked in the upper-left hand corner. This playlist will show a menu on hover/click showing the playlist names, then hovering on a playlist will open a menu to the side letting you see which songs are in it and letting you add/remove songs.
- An ability to queue songs and shuffle playlists (but also be able to change their order once shuffled).

```
Playlist Editor: List of checkboxes determining which songs are allowed based on the list of tracks. Then it autogenerates an array you copy into it.

{"playlist name": [1,2,3,4,5]}

Use this format because the string key might have escaped characters. Then to make it easier, prepend a "playlists": so users know where to put it.

Also, add and remove playlists based on the current thing. And set the default playlist.

	"defaultPlaylist": "main",
	"playlists":
	{
		"main": [3,5,8],
		"playlist name": [1,2,3,4,5]
	}

Playlist Editor button to the right of playlists.

Hover over an entry to see its full name, otherwise you'll just see the start of it.
```