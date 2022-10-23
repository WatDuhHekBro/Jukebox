"use strict";

const MusicPlayer = {
	volume: 1,
	fadeDuration: 5,
	tracks: [],
	playlists: {},
	displayFormat: "$game - $name",
	currentPlaylist: null, // Array of track indexes
	currentSong: null, // Song instance
	currentTrack: null,
	currentTrackIndex: -1,
	// When MusicPlayer.play is called multiple times in rapid succession, it will reset its internal delay so you get the effect of having it be silent until you settle on a song you like.
	play(index)
	{
		if(index < 0 || index >= this.tracks.length)
			throw `Index out of bounds! Index ${index} was given to MusicPlayer.play, but the length of its array is ${this.tracks.length}.`;
		this.currentTrack = this.tracks[index];
		this.currentSong = new Song(this.currentTrack, this.volume);
		this.currentTrackIndex = index;
		Timer.start();
	},
	// It isn't a good type of random for this, it's better to make a shuffled queue and play that instead because a song can appear multiple times in rapid succession.
	playRandom()
	{
		if(this.currentPlaylist)
			this.play(this.currentPlaylist[Math.floor(Math.random() * this.currentPlaylist.length)]);
		else
			this.play(Math.floor(Math.random() * this.tracks.length));
	},
	stop()
	{
		this.currentSong && this.currentSong.destroy();
		this.currentTrack = null;
		this.currentSong = null;
		this.currentTrackIndex = -1;
		Timer.stop();
		App.resetTimer(); // I know, I know. I said I'd keep everything separate, but it'd be a lot more convenient just to access App this one time.
	},
	setVolume(value)
	{
		localStorage.setItem("Jukebox", JSON.stringify({
			defaultVolume: value * 100
		}));
		this.currentSong && this.currentSong.setVolume(value);
		this.volume = Song.capVolume(value);
	},
	pause(isInstant = false)
	{
		this.currentSong && this.currentSong.pause(isInstant ? 0 : this.fadeDuration);
	},
	resume(isInstant = false)
	{
		this.currentSong && this.currentSong.resume(isInstant ? 0 : this.fadeDuration);
	},
	setPlaylist(identifier)
	{
		if(this.playlists && this.playlists[identifier])
			this.currentPlaylist = this.playlists[identifier];
		else
			this.currentPlaylist = null;
	},
	shuffleCurrentPlaylist()
	{
		if(this.playlists)
		{
			// https://medium.com/@nitinpatel_20236/how-to-shuffle-correctly-shuffle-an-array-in-javascript-15ea3f84bfb
		}
	},
	getCurrentTime()
	{
		return (this.currentSong && Timer.getFormattedTime(Math.floor(this.currentSong.context.currentTime))) || "N/A";
	},
	getIcon()
	{
		if(this.currentTrack && this.currentTrack.icon)
			return `url(${this.currentTrack.icon})`;
		else
			return "url(icon.png)";
	},
	// e.g. "CrossCode - The Path of Justice"
	toString()
	{
		let output = "<i>None</i>";

		if(this.currentTrack)
		{
			if(this.displayFormat)
			{
				output = this.displayFormat.replace(/\$\$/g, '\u0000');
				output = output.replace(/\$name/g, this.currentTrack.name || "").replace(/\$game/g, this.currentTrack.game || "");
				output = output.replace(/\u0000/g, '$');
			}
			else
				output = `${this.currentTrack.game} - ${this.currentTrack.name}`;
		}

		return output;
	}
};