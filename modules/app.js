"use strict";

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
			let userConfig = localStorage.getItem("Jukebox");

			if(userConfig) {
				try {
					userConfig = JSON.parse(userConfig);
				} catch(error) {
					console.error(error);
				}
			}

			let defaultPlaylist = "";
			if(userConfig && ("defaultVolume" in userConfig)) MusicPlayer.volume = Song.capDisplayVolume(userConfig.defaultVolume) / 100;
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
				else if(defaultPlaylist !== "")
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
			// Firefox's media controls seem to need at least *some* sound to activate. It can just be minisculely so however.
			this.silence.volume = 0.001;
			navigator.mediaSession.setActionHandler("play", () => {this.togglePause()});
			navigator.mediaSession.setActionHandler("pause", () => {this.togglePause()});
			navigator.mediaSession.setActionHandler("nexttrack", () => {this.setSong()});
			this.chromeGlobalMediaControlsUpdate();
		}
	}
};