"use strict";

class Song
{
	constructor(track, volume = 0.5)
	{
		this.context = new AudioContext();
		this.gainNode = this.context.createGain();
		this.hasLockedVolume = false;
		this.setVolume(volume);
		
		// Play Song //
		// This is integrated into the constructor because especially for complex looping, delaying the song will mess with context.currentTime which'll in turn mess with looping.
		if(track.complexLooping)
		{
			// Request it once, as opposed to the main loop which'll pass down the buffer.
			if(track.introPath)
			{
				let introSource = this.context.createBufferSource();
				
				// The delay should sync up for both the intro and the main if there's an intro, so nest those calls to chain them together.
				Song.request(track.introPath, this.context).then(buffer => {
					introSource.buffer = buffer;
					introSource.connect(this.gainNode);
					this.gainNode.connect(this.context.destination);
					return Song.request(track.path, this.context);
				}).then(buffer => {
					introSource.start();
					let loopEnd = track.loopEnd || buffer.duration;
					let delay = this.context.currentTime + (track.introEnd || 0);
					Song.playOneLoop(buffer, this.context, this.gainNode, loopEnd, delay, 0);
					Song.playOneLoop(buffer, this.context, this.gainNode, loopEnd, delay, 1);
				}).catch(console.error);
			}
			else
			{
				// Even and odd offsets which will keep the cycle going.
				Song.request(track.path, this.context).then(buffer => {
					// Nonetheless, you still have to account for the delay. A considerable amount of time passes between the request and the access.
					// Still though, it's better to put it in the constructor since you don't have to wait on whether or not the buffer is loaded.
					// And you don't need to worry about it for the intro since it plays immediately.
					// You have to place the delay here since the delay is based on the time it takes to load this section.
					let loopEnd = track.loopEnd || buffer.duration;
					let delay = this.context.currentTime;
					Song.playOneLoop(buffer, this.context, this.gainNode, loopEnd, delay, 0);
					Song.playOneLoop(buffer, this.context, this.gainNode, loopEnd, delay, 1);
				}).catch(console.error);
			}
		}
		else
		{
			Song.request(track.path, this.context).then(buffer => {
				let source = this.context.createBufferSource();
				source.buffer = buffer;
				source.connect(this.gainNode);
				this.gainNode.connect(this.context.destination);
				source.loop = true;
				source.loopStart = track.loopStart || 0;
				source.loopEnd = track.loopEnd || buffer.duration; // loopStart doesn't work if loopEnd is 0.
				source.start();
			}).catch(console.error);
		}
	}
	pause(duration = 5)
	{
		
	}
	resume(duration = 5)
	{
		
	}
	setVolume(value)
	{
		if(value > 1 || value < 0)
			throw `The volume of a song must be between 0 and 1 (inclusive)! The value given was ${value}.`;
		if(!this.hasLockedVolume)
			this.gainNode.gain.value = value;
	}
	destroy()
	{
		this.context.close();
	}
	// Only call later nodes when necessary, which is what the onended listener is for.
	static playOneLoop(buffer, context, gainNode, loopEnd, delay, loopCount)
	{
		let source = context.createBufferSource();
		source.buffer = buffer;
		source.connect(gainNode);
		gainNode.connect(context.destination);
		// AudioBufferSourceNode.start uses the AudioContext's currentTime for its delay rather than the amount of time from when it's called, meaning you don't have to mess with part after a song's loop or adjust for the current time in relation to the starting time. Just specify which offset it'll play at.
		source.onended = () => {Song.playOneLoop(buffer, context, gainNode, loopEnd, delay, loopCount + 2)};
		source.start(loopCount * loopEnd + delay);
	}
	static request(path, context)
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
						context.decodeAudioData(request.response)
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
}

const Timer = {
	// The reason I create an interval every time the user pauses and resumes the timer is because the timer will start counting after exactly 1 second rather than anywhere in between that second and it saves memory (I think).
	interval: 0,
	resetToTime: 5,
	enabled: false,
	listeners: {},
	iterate()
	{
		if(this.seconds <= 0)
		{
			this.stop();
			return;
		}
		
		this.seconds--;
		
		if(this.seconds in this.listeners)
			this.listeners[this.seconds]();
	},
	toggle()
	{
		if(this.enabled)
			this.stop();
		else
			this.start();
	},
	start()
	{
		if(this.seconds <= 0)
			this.seconds = this.resetToTime;
		if(this.interval !== 0)
			throw "Warning: Another interval was called but there's already an interval!";
		this.interval = setInterval(this.iterate.bind(this), 1000);
		this.enabled = true;
	},
	stop()
	{
		clearInterval(this.interval);
		this.interval = 0;
		this.enabled = false;
	},
	setListener(seconds, handler)
	{
		if(!handler || handler.constructor !== Function)
			throw "Error: Timer.setListener was called but no handler was provided!";
		this.listeners[seconds] = handler;
	},
	// 0:00, 0:59, 1:00, 9:59, 10:00, 59:99, 1:00:00, 9:59:59, 10:00:00, ...
	toString()
	{
		let output = "";
		let minutes = Math.floor(this.seconds/60);
		let seconds = this.seconds%60;
		
		if(minutes >= 60)
		{
			let hours = Math.floor(minutes/60);
			minutes = minutes%60;
			output = `${hours.toString()}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
		}
		else
			output = `${minutes.toString()}:${seconds.toString().padStart(2, '0')}`;
		
		return output;
	}
};
Timer.seconds = Timer.resetToTime;

const MusicPlayer = {
	volume: 0.5,
	fadeDuration: 5,
	timerEnabled: false,
	tracks: null,
	playlists: null,
	currentTrack: null,
	currentPlaylist: null, // Array of track indexes
	currentSong: null, // Song instance
	// When MusicPlayer.play is called multiple times in rapid succession, it will reset its internal delay so you get the effect of having it be silent until you settle on a song you like.
	play(index)
	{
		
	},
	playRandom(playlist)
	{
		
	},
	stop()
	{
		
	},
	// The volume is 50% by default, but can be changed upon loading your config.
	setVolume(value)
	{
		this.song && this.song.setVolume(value);
	},
	setPlaylist(identifier)
	{
		if(this.playlists)
			this.currentPlaylist = this.playlists[identifier];
	},
	shuffleCurrentPlaylist()
	{
		if(this.playlists)
		{
			// https://medium.com/@nitinpatel_20236/how-to-shuffle-correctly-shuffle-an-array-in-javascript-15ea3f84bfb
		}
	},
	getIcon()
	{
		if(this.currentTrack && this.currentTrack.icon)
			return this.currentTrack.icon;
		else
			return "url(icon.png)";
	},
	// e.g. "CrossCode - The Path of Justice"
	toString()
	{
		let output = "<i>None</i>";
		
		if(currentTrack)
			output = `${this.currentTrack.game} - ${this.currentTrack.name}`;
		
		return output;
	}
};

(() => {
	window.onerror = (message, source, lineno, colno, e) => {
		let error = document.getElementById("error");
		error.style.display = "block";
		error.innerHTML = message;
	};
	
	if(!window.AudioContext)
		throw "Sorry, your browser doesn't support the Web Audio API!";
	
	let request = new XMLHttpRequest();
	request.open("GET", "assets/config.json");
	request.onload = () => {
		let config = JSON.parse(request.responseText);
		MusicPlayer.volume = config.defaultVolume;
		MusicPlayer.fadeDuration = config.fadeDuration;
		Timer.resetToTime = config.timeBetweenSongs;
		MusicPlayer.timerEnabled = config.startWithTimer;
		MusicPlayer.playlists = config.playlists;
		MusicPlayer.tracks = config.tracks;
	};
	request.send();
})()

// The App object is used by the document and should therefore have a one-to-one correlation with any function it has. Any multi-functionality present should be outside App in order to further modularize the code (meaning the program should be fully functional by just using the console).
const App = {
	
};