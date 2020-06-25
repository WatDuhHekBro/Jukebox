"use strict";

class Song
{
	constructor(track, volume = 0.5)
	{
		this.context = new AudioContext();
		this.volume = this.context.createGain();
		this.fade = this.context.createGain();
		this.timeout = 0;
		this.isDestroyed = false;
		this.setVolume(volume);
		
		// Play Song //
		// This is integrated into the constructor because especially for complex looping, delaying the song will mess with context.currentTime which'll in turn mess with looping.
		if(track.complexLooping)
		{
			// Request it once, as opposed to the main loop which'll pass down the buffer.
			if(track.introPath)
			{
				let introSource = this.context.createBufferSource();
				introSource.connect(this.volume);
				this.volume.connect(this.fade);
				this.fade.connect(this.context.destination);
				
				// The delay should sync up for both the intro and the main if there's an intro, so nest those calls to chain them together.
				this.request(track.introPath).then(buffer => {
					if(this.isDestroyed)
						return;
					introSource.buffer = buffer;
					return this.request(track.path);
				}).then(buffer => {
					if(this.isDestroyed)
						return;
					introSource.start();
					let loopEnd = track.loopEnd || buffer.duration;
					let delay = this.context.currentTime + (track.introEnd || 0);
					this.playOneLoop(buffer, loopEnd, delay, 0);
					this.playOneLoop(buffer, loopEnd, delay, 1);
				}).catch(console.error);
			}
			else
			{
				// Even and odd offsets which will keep the cycle going.
				this.request(track.path).then(buffer => {
					if(this.isDestroyed)
						return;
					// Nonetheless, you still have to account for the delay. A considerable amount of time passes between the request and the access.
					// Still though, it's better to put it in the constructor since you don't have to wait on whether or not the buffer is loaded.
					// And you don't need to worry about it for the intro since it plays immediately.
					// You have to place the delay here since the delay is based on the time it takes to load this section.
					let loopEnd = track.loopEnd || buffer.duration;
					let delay = this.context.currentTime;
					this.playOneLoop(buffer, loopEnd, delay, 0);
					this.playOneLoop(buffer, loopEnd, delay, 1);
				}).catch(console.error);
			}
		}
		else
		{
			this.request(track.path).then(buffer => {
				if(this.isDestroyed)
					return;
				let source = this.context.createBufferSource();
				source.buffer = buffer;
				source.connect(this.volume);
				this.volume.connect(this.fade);
				this.fade.connect(this.context.destination);
				source.loop = true;
				source.loopStart = track.loopStart || 0;
				source.loopEnd = track.loopEnd || buffer.duration; // loopStart doesn't work if loopEnd is 0.
				source.start();
			}).catch(console.error);
		}
	}
	// For the pause and resume functions, I decided to use linearRampToValueAtTime instead of exponentialRampToValueAtTime because not only is exponentialRampToValueAtTime a pain to work with (must be > 0), it seems to be broken. Fading in from a low value works fine, but fading out from a value like 1 makes it instant, which is what I don't want to happen.
	// Weird bug: Pausing after a fade in will stop it instantly and make an instant resume fade in again.
	pause(duration = 5)
	{
		if(duration <= 0)
			this.context.suspend();
		else
		{
			this.fade.gain.cancelAndHoldAtTime(0); // Change it ASAP so the effects are instant.
			this.fade.gain.linearRampToValueAtTime(this.fade.gain.value, 0); // Okay, so for some odd reason, if you fully resume and then you pause, the next linearRampToValueAtTime will be instant regardless of the fact that you're setting it relative to the context's currentTime. However, a quick fix for this is to call it once so that the next linearRampToValueAtTime works as intended.
			this.fade.gain.linearRampToValueAtTime(0, this.context.currentTime + duration);
			this.timeout = setTimeout(() => {
				if(!this.isDestroyed)
					this.context.suspend();
				this.timeout = 0;
			}, duration * 1000);
		}
	}
	resume(duration = 5)
	{
		if(duration <= 0)
			this.context.resume();
		else
		{
			this.fade.gain.cancelAndHoldAtTime(0); // Change it ASAP so the effects are instant.
			this.fade.gain.linearRampToValueAtTime(1, this.context.currentTime + duration);
			this.context.resume();
			clearTimeout(this.timeout);
			this.timeout = 0;
		}
	}
	destroy()
	{
		// Set isDestroyed to true before closing the context because it takes time to close.
		this.isDestroyed = true;
		this.context.close();
	}
	setVolume(value)
	{
		this.volume.gain.value = Song.capVolume(value);
	}
	// Only call later nodes when necessary, which is what the onended listener is for.
	playOneLoop(buffer, loopEnd, delay, loopCount)
	{
		if(this.isDestroyed)
			return;
		let source = this.context.createBufferSource();
		source.buffer = buffer;
		source.connect(this.volume);
		this.volume.connect(this.fade);
		this.fade.connect(this.context.destination);
		// AudioBufferSourceNode.start uses the AudioContext's currentTime for its delay rather than the amount of time from when it's called, meaning you don't have to mess with part after a song's loop or adjust for the current time in relation to the starting time. Just specify which offset it'll play at.
		source.onended = () => {this.playOneLoop(buffer, loopEnd, delay, loopCount + 2)};
		source.start(loopCount * loopEnd + delay);
	}
	request(path)
	{
		return new Promise((resolve, reject) => {
			let request = new XMLHttpRequest();
			request.open("GET", path);
			request.responseType = "arraybuffer";
			request.onreadystatechange = () => {
				if(request.readyState === 4)
				{
					if(request.status === 200)
					{
						this.context.decodeAudioData(request.response)
						.then(buffer => resolve(buffer))
						.catch(reject);
					}
					else
						reject(`Path: "${path}" - ${request.status} (${request.statusText})`);
				}
			};
			request.send();
		});
	}
	// Returns the value between 0 to 1.
	static capVolume(value, disableWarning = false)
	{
		if((value > 1 || value < 0) && !disableWarning)
			console.warn(`The volume of a song must be between 0 and 1! The value given was ${value}.`);
		
		let output = Math.max(Math.min(value, 1), 0);
		
		if(isNaN(output))
			throw `Invalid volume output ${output} from ${value}!`;
		
		return output;
	}
	// Returns the value as an integer between 0 to 100.
	static capDisplayVolume(value, disableWarning = false)
	{
		if((value > 100 || value < 0) && !disableWarning)
			console.warn(`The display volume must be between 0 and 100! The value given was ${value}.`);
		
		let output = Math.max(Math.min(parseInt(value), 100), 0);
		
		if(isNaN(output))
			throw `Invalid volume output ${output} from ${value}!`;
		
		return output;
	}
}

const Timer = {
	// The reason I create an interval every time the user pauses and resumes the timer is because the timer will start counting after exactly 1 second rather than anywhere in between that second and it saves memory (I think).
	interval: 0,
	resetToTime: 180,
	seconds: 0, // It'll automatically go to Timer.resetToTime when started.
	enabled: false,
	listener: null,
	iterate()
	{
		if(this.seconds <= 0)
		{
			this.stop();
			return;
		}
		
		this.seconds--;
		this.listener && this.listener(this.seconds);
	},
	start()
	{
		if(this.enabled)
		{
			if(this.seconds <= 0)
				this.reset();
			if(this.interval !== 0)
				throw "Warning: Another interval was called but there's already an interval!";
			this.interval = setInterval(this.iterate.bind(this), 1000);
		}
	},
	stop()
	{
		clearInterval(this.interval);
		this.interval = 0;
	},
	reset()
	{
		this.seconds = this.resetToTime;
	},
	setListener(handler)
	{
		if(!handler || (handler.constructor && handler.constructor !== Function))
			throw "Error: Timer.setListener was called but no handler (or an invalid one) was provided!";
		this.listener = handler;
	},
	// 0:00, 0:59, 1:00, 9:59, 10:00, 59:99, 1:00:00, 9:59:59, 10:00:00, ...
	getFormattedTime(seconds)
	{
		let minutes = Math.floor(seconds / 60);
		seconds = seconds % 60;
		
		if(minutes >= 60)
		{
			let hours = Math.floor(minutes / 60);
			minutes = minutes % 60;
			return `${hours.toString()}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
		}
		else
			return `${minutes.toString()}:${seconds.toString().padStart(2, '0')}`;
	},
	toString()
	{
		return this.getFormattedTime(this.seconds);
	}
};

const MusicPlayer = {
	volume: 0.5,
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

// The App object is used by the document and should therefore have a one-to-one correlation with any function it has. Any multi-functionality present should be outside App in order to further modularize the code (meaning the program should be fully functional by just using the console).
const App = {
	playerDisplay: document.getElementById("player"),
	top: document.getElementById("top"),
	songName: document.getElementById("song"),
	bottom: document.getElementById("bottom"),
	pauseButton: document.getElementById("control"),
	trackMenu: document.getElementById("tracklist"),
	playlistMenu: document.getElementById("playlists"),
	timer: document.getElementById("countdown"),
	timerStatus: document.getElementById("timerStatus"),
	volumeDisplay: document.getElementById("volume"),
	volumeSlider: document.getElementById("volumeSlider"),
	volumeSpeaker: document.getElementById("speaker"),
	playlistEditor: document.getElementById("playlistEditor"),
	banner: document.getElementById("error"),
	silence: null, // This is an HTML audio element that'll be used to activate Chrome's global media controls as a workaround because the WebAudio API can't.
	isPaused: true,
	isMuted: false,
	inTrackingMode: false,
	interval: 0,
	initialize()
	{
		window.onerror = (message, source, line, column, error) => {
			this.banner.style.display = "block";
			this.banner.innerHTML = error;
		};
		
		if(!window.AudioContext)
			throw "Sorry, your browser doesn't support the Web Audio API!";
		
		let request = new XMLHttpRequest();
		request.open("GET", "config.json");
		request.onload = () => {
			// Load the list of tracks and their metadata, but don't load buffers into memory all at once since it hogs up at least 3 GB of memory.
			let config = JSON.parse(request.responseText);
			let defaultPlaylist = "";
			if("defaultVolume" in config) MusicPlayer.volume = Song.capDisplayVolume(config.defaultVolume) / 100;
			if("fadeDuration" in config) MusicPlayer.fadeDuration = Math.max(config.fadeDuration, 0);
			if("timeBetweenSongs" in config) Timer.resetToTime = Math.max(Math.floor(config.timeBetweenSongs), 0);
			if("startWithTimer" in config) Timer.enabled = !!config.startWithTimer;
			if("defaultPlaylist" in config) defaultPlaylist = config.defaultPlaylist;
			if("playlists" in config) MusicPlayer.playlists = config.playlists;
			if("displayFormat" in config) MusicPlayer.displayFormat = config.displayFormat;
			if("tracks" in config) MusicPlayer.tracks = config.tracks;
			
			// Tracks //
			
			if(MusicPlayer.tracks.length === 0)
				throw "You must have at least one track to use the jukebox!";
			
			while(this.trackMenu.firstElementChild)
				this.trackMenu.removeChild(this.trackMenu.firstElementChild);
			
			for(let i = -1; i < MusicPlayer.tracks.length; i++)
			{
				let option = document.createElement("option");
				option.value = i;
				option.innerText = i === -1 ? "" : MusicPlayer.tracks[i].name;
				this.trackMenu.appendChild(option);
			}
			
			// Playlists //
			
			if(Object.keys(MusicPlayer.playlists).length === 0)
				this.playlistMenu.style.display = "none";
			else
			{
				while(this.playlistMenu.firstElementChild)
					this.playlistMenu.removeChild(this.playlistMenu.firstElementChild);
				
				this.playlistMenu.appendChild(document.createElement("option"));
				
				for(let name in MusicPlayer.playlists)
				{
					let option = document.createElement("option");
					option.value = name;
					option.innerText = name;
					this.playlistMenu.appendChild(option);
				}
				
				if(defaultPlaylist in MusicPlayer.playlists)
				{
					MusicPlayer.setPlaylist(defaultPlaylist);
					this.playlistMenu.value = defaultPlaylist;
				}
				else
					console.warn(`"${defaultPlaylist}" is not a valid playlist!`);
			}
			
			// Other //
			
			this.setDisplayVolume(MusicPlayer.volume * 100);
			this.resetTimer();
			this.timerStatus.checked = Timer.enabled;
			Timer.setListener(seconds => {
				this.timer.innerText = Timer.toString();
				
				if(seconds <= 0)
					this.setSong();
			});
			this.chromeGlobalMediaControlsInit();
			
			// Done //
			
			this.bottom.style.display = "block";
		};
		request.send();
	},
	// Document-only function, called by App.trackMenu.
	setSong(index, skipChangingMenu = false)
	{
		// temporary code below
		MusicPlayer.stop();
		
		if(index === undefined)
			MusicPlayer.playRandom();
		else if(index >= 0)
			MusicPlayer.play(index);
		
		this.setDisplaySong(skipChangingMenu);
		this.isPaused = false;
		this.pauseButton.innerText = this.getPausedIcon(false);
		this.setTrackingMode(false);
		this.silence && this.silence.play();
	},
	setPlaylist(name)
	{
		MusicPlayer.setPlaylist(name);
	},
	setVolume(value)
	{
		this.setDisplayVolume(value);
		MusicPlayer.setVolume(Song.capVolume(parseInt(value) / 100));
	},
	togglePause()
	{
		this.isPaused = !this.isPaused;
		this.pauseButton.innerText = this.getPausedIcon(this.isPaused);
		
		// Prevent this function from changing the volume if it's muted. It still pauses and plays though, just at 0 volume.
		if(this.isPaused)
		{
			MusicPlayer.pause(this.isMuted);
			Timer.stop();
			this.silence && this.silence.pause();
		}
		else
		{
			MusicPlayer.resume(this.isMuted);
			
			if(MusicPlayer.currentSong)
				Timer.start();
			
			this.silence && this.silence.play();
		}
	},
	toggleMute()
	{
		this.isMuted = !this.isMuted;
		this.volumeSlider.disabled = this.isMuted;
		MusicPlayer.setVolume(this.isMuted ? 0 : (Song.capDisplayVolume(this.volumeSlider.value) / 100));
		this.volumeSpeaker.innerText = this.isMuted ? '🔇' : this.getSpeakerIcon(Song.capDisplayVolume(this.volumeSlider.value));
	},
	toggleTimer()
	{
		Timer.enabled = !Timer.enabled;
		
		// Even if the timer is enabled, it'll only run if a song is playing.
		if(!this.isPaused && MusicPlayer.currentSong)
		{
			if(Timer.enabled)
				Timer.start();
			else
				Timer.stop();
		}
	},
	resetTimer()
	{
		Timer.reset();
		this.timer.innerText = Timer.toString();
	},
	// Leave empty for a toggle.
	setTrackingMode(value)
	{
		this.inTrackingMode = value !== undefined ? !!value : !this.inTrackingMode;
		
		if(this.inTrackingMode)
		{
			this.songName.innerHTML = `You've been playing this song for: ${MusicPlayer.getCurrentTime()}`;
			this.interval = setInterval(() => {
				this.songName.innerHTML = `You've been playing this song for: ${MusicPlayer.getCurrentTime()}`;
			}, 500);
		}
		else
		{
			this.songName.innerHTML = MusicPlayer.toString();
			clearInterval(this.interval);
			this.interval = 0;
		}
	},
	setDisplaySong(calledFromDocument = false)
	{
		let track = MusicPlayer.currentTrack;
		document.title = track ? `🎵 ${track.name} 🎵` : "Jukebox";
		this.songName.innerHTML = MusicPlayer.toString();
		this.playerDisplay.style.backgroundImage = MusicPlayer.getIcon();
		
		if(!calledFromDocument)
			this.trackMenu.value = MusicPlayer.currentTrackIndex;
		
		this.chromeGlobalMediaControlsUpdate();
	},
	setDisplayVolume(volume, calledFromDocument = false)
	{
		let displayVolume = Song.capDisplayVolume(volume);
		this.volumeDisplay.innerText = `${displayVolume}%`;
		
		if(!calledFromDocument)
			this.volumeSlider.value = displayVolume;
		
		this.volumeSpeaker.innerText = this.getSpeakerIcon(displayVolume);
	},
	getSpeakerIcon(value)
	{
		if(value <= 0)
			return '🔈';
		else if(value < 50)
			return '🔉';
		else
			return '🔊';
	},
	getPausedIcon(isPaused)
	{
		return isPaused ? '▶️' : '⏸️';
	},
	// Document-only function, called by App.volumeSlider when scrolling.
	scrollVolume(e)
	{
		if(this.isMuted)
			return;
		
		let delta = event.deltaY;
		let direction = -delta / Math.abs(delta);
		let currentDisplayVolume = parseInt(e.value);
		let newDisplayVolume;
		
		// Go to the nearest number divisible by 5 like VLC.
		if(currentDisplayVolume % 5 !== 0)
		{
			newDisplayVolume = currentDisplayVolume - (currentDisplayVolume % 5); // Floored value.
			
			if(direction > 0)
				newDisplayVolume += 5;
		}
		else
			newDisplayVolume = Song.capDisplayVolume(currentDisplayVolume + direction * 5, true);
		
		e.value = newDisplayVolume;
		this.setDisplayVolume(newDisplayVolume, true);
		MusicPlayer.setVolume(newDisplayVolume / 100);
	},
	chromeGlobalMediaControlsUpdate()
	{
		if("mediaSession" in navigator)
		{
			navigator.mediaSession.metadata = new MediaMetadata({
				album: "Jukebox",
				title: MusicPlayer.currentTrack && MusicPlayer.currentTrack.name || "None",
				artist: MusicPlayer.currentTrack && MusicPlayer.currentTrack.game || "",
				// I decided to just stick with icon.png. I know for certain that it'll be 128x128, plus, I've noticed that other icons tend to be quite inconsistent.
				artwork: [{
					src: "icon.png",
					sizes: "128x128"
				}]
			});
		}
	},
	chromeGlobalMediaControlsInit()
	{
		if("mediaSession" in navigator)
		{
			this.silence = new Audio();
			// Seems like 5 seconds is the threshold determining whether or not Chrome's global media controls appear.
			this.silence.src = "silence.mp3";
			this.silence.loop = true;
			navigator.mediaSession.setActionHandler("play", () => {this.togglePause()});
			navigator.mediaSession.setActionHandler("pause", () => {this.togglePause()});
			navigator.mediaSession.setActionHandler("nexttrack", () => {this.setSong()});
			this.chromeGlobalMediaControlsUpdate();
		}
	}
};

App.initialize();