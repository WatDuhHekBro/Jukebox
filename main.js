"use strict";

// Try to get rid of these and place them in easy-to-understand objects.
let tracks, volume, allowed, music, song; // Declare
const player = document.getElementById("player");
const list = document.getElementById("tracklist");
const songname = document.getElementById("song");
const timer = document.getElementById("countdown");
const volNum = document.getElementById("volume");
const volSlider = document.getElementById("volumeSlider");
const volSpeaker = document.getElementById("speaker");
const control = document.getElementById("control");
const error = document.getElementById("error");
let countdown = 300;
let countdownEnabled = false;
let isStopped = true;
let isTransitioning = false;

// Maybe use setInterval to have more checks?
class MusicPlayer
{
	constructor(track)
	{
		// Actually, create a new AudioContext per song. That way, you can release all system resources at once and not have to worry about read-only properties like currentTime. Just start anew.
		this.context = new AudioContext();
		this.gainNode = this.context.createGain();
		this.gainNode.gain.value = volume;
		this.game = track.game;
		this.path = track.path;
		this.loopStart = track.loopStart || 0;
		this.loopEnd = track.loopEnd || 0;
		this.complex = !!track.complexLooping;
		this.introOffset = track.introEnd || 0;
		this.introPath = track.introPath;
		this.isPlaying = true;
		
		// Play Song //
		// This is integrated into the constructor because especially for complex looping, delaying the song will mess with context.currentTime which'll in turn mess with looping.
		if(this.complex)
		{
			// Request it once, as opposed to the main loop which'll pass down the buffer.
			if(this.introPath)
			{
				// The delay should sync up for both the intro and the main if there's an intro, so nest those calls to chain them together.
				this.requestMusic(this.introPath, data => {
					this.context.decodeAudioData(data, buffer => {
						let introBuffer = buffer;
						
						this.requestMusic(this.path, data => {
							this.context.decodeAudioData(data, buffer => {
								let source = this.context.createBufferSource();
								source.buffer = introBuffer;
								source.connect(this.gainNode);
								this.gainNode.connect(this.context.destination);
								source.start();
								
								this.delay = this.context.currentTime;
								this.playOneLoop(buffer, 0);
								this.playOneLoop(buffer, 1);
							}, console.error);
						});
					}, console.error);
				});
			}
			else
			{
				// Even and odd offsets which will keep the cycle going.
				this.requestMusic(this.path, data => {
					this.context.decodeAudioData(data, buffer => {
						// Nonetheless, you still have to account for the delay. A considerable amount of time passes between the request and the access.
						// Still though, it's better to put it in the constructor since you don't have to wait on whether or not the buffer is loaded.
						// And you don't need to worry about it for the intro since it plays immediately.
						// You have to place the delay here since the delay is based on the time it takes to load this section.
						this.delay = this.context.currentTime;
						this.playOneLoop(buffer, 0);
						this.playOneLoop(buffer, 1);
					}, console.error);
				});
			}
		}
		else
		{
			this.requestMusic(this.path, data => {
				this.context.decodeAudioData(data, buffer => {
					let source = this.context.createBufferSource();
					source.buffer = buffer;
					source.connect(this.gainNode);
					this.gainNode.connect(this.context.destination);
					source.loop = true;
					source.loopStart = this.loopStart;
					source.loopEnd = this.loopEnd || buffer.duration; // loopStart doesn't work if loopEnd is 0 (it's set to 0 by default).
					source.start();
				}, console.error);
			});
		}
	}
	// Only call later nodes when necessary, which is what the onended listener is for.
	playOneLoop(buffer, loopCount)
	{
		let source = this.context.createBufferSource();
		source.buffer = buffer;
		source.connect(this.gainNode);
		this.gainNode.connect(this.context.destination);
		// AudioBufferSourceNode.start uses the AudioContext's currentTime for its delay rather than the amount of time from when it's called, meaning you don't have to mess with part after a song's loop or adjust for the current time in relation to the starting time. Just specify which offset it'll play at.
		source.onended = () => {this.playOneLoop(buffer, loopCount + 2)};
		source.start(loopCount * this.loopEnd + this.introOffset + this.delay);
	}
	requestMusic(path, callback)
	{
		let request = new XMLHttpRequest();
		request.open("GET", path);
		request.responseType = "arraybuffer";
		request.onload = function() {callback && callback(request.response)};
		request.send();
	}
	pause()
	{
		this.isFading = true;
		
		if(this.isPlaying)
		{
			// Fade out and pause, suspending the context after 3 seconds.
			this.gainNode.gain.setTargetAtTime(0, this.context.currentTime, 1);
			this.timeout = setTimeout(() => {
				if(!this.isDestroyed)
					this.context.suspend();
				this.isFading = false;
			}, 3000);
		}
		else
		{
			// Fade in and resume, and prevent pausing if it's called before the 3 seconds.
			this.gainNode.gain.setTargetAtTime(volume, this.context.currentTime, 1);
			clearTimeout(this.timeout);
			this.context.resume();
			this.isFading = false;
		}
		
		this.isPlaying = !this.isPlaying;
	}
	// Eventually add a fade out between songs.
	destroy()
	{
		this.context.close();
		this.isDestroyed = true;
	}
}

/*const timerControl = {
	
};

const volumeControl = {
	
};

const errorControl = {
	
};*/

/////////////////////////////////
// Document-Specific Functions //
/////////////////////////////////

(() => {
	// Let the user know if it isn't going to work.
	if(!window.AudioContext)
	{
		error.style.display = "block";
		error.innerHTML = "Sorry, your browser doesn't support the Web Audio API!";
	}
	else
	{
		// Fields: allowed, volume (0.5), timer (180), startWithTimer (false), darkMode (false), tracks ([])
		request("config.json", data => {
			let config = JSON.parse(data);
			// Throw an error (change the error banner text) if your config doesn't have these two keys. Or maybe don't throw an error at all for games.
			// icon.png in each folder, and also you can have custom icons per song if you really want to do that
			tracks = config.tracks;
			allowed = config.allowed;
			
			// Load the list of tracks and their metadata, but don't load buffers into memory all at once since it hogs up at least 3 GB of memory.
			while(list.firstElementChild)
				list.removeChild(list.firstElementChild);
			
			let option = document.createElement("option");
			option.value = -1;
			
			list.appendChild(option);
			
			for(let i = 0; i < tracks.length; i++)
			{
				option = document.createElement("option");
				option.value = i;
				option.innerText = tracks[i].name;
				list.appendChild(option);
			}
			
			// Setup non-essential stuff
			if(config.volume)
			{
				volSlider.value = Math.max(Math.min(config.volume), 0) * 100;
				setVolume(volSlider.value);
			}
			else
				setVolume(50);
		});
	}
})()

setInterval(() => {
	if(countdownEnabled && !isStopped)
	{
		countdown--;
		
		if(countdown === 3 && music.isPlaying)
			music.pause();
		
		if(countdown <= 0)
		{
			music.destroy();
			music = undefined;
			setSong();
			countdown = 300;
		}
		
		let minutes = Math.floor(countdown / 60);
		let seconds = countdown % 60;
		timer.innerText = `${minutes}:${seconds.toString().padStart(2, '0')}`;
	}
}, 1000);

// Set background based on the game, which is a property in the tracks. Game logo.
// Fading: exponentialRampToValueAtTime and cancelAndHoldAtTime
function setSong(index)
{
	// stop currently-playing song
	if(music)
	{
		if(music.isPlaying)
		{
			music.pause();
			setTimeout(m => {m.destroy()}, 3000, music);
		}
		else
		{
			music.destroy();
			music = undefined;
		}
	}
	
	// stop all music
	if(index === -1)
	{
		music = undefined;
		songname.innerHTML = "<i>None</i>";
		player.style.backgroundImage = "url(icon.png)";
		document.title = "Jukebox";
		isStopped = true;
		countdown = 300;
		timer.innerText = "5:00";
		return;
	}
	else
		isStopped = false;
	
	// random song on the allowed list
	if(index === undefined)
	{
		if(allowed)
			index = allowed[Math.floor(Math.random() * allowed.length)];
		else
			index = Math.floor(Math.random() * tracks.length);
		
		list.value = index;
	}
	
	song = tracks[index];
	songname.innerHTML = song.game + " - " + song.name;
	player.style.backgroundImage = `url(${song.icon})`;
	document.title = `🎵 ${song.name} 🎵`;
	
	// The timeout here is so that if you change the song during the timeout, the music player won't fire off a billion instances.
	// BUG: Multiple clicks still throw errors. Make sure to have a good system in place to handle all requests.
	if(!isTransitioning)
	{
		setTimeout(() => {
			music = new MusicPlayer(song);
			countdown = 300;
			timer.innerText = "5:00";
			control.innerText = '⏸️';
			isTransitioning = false;
		}, music ? 3000 : 0);
		isTransitioning = true;
	}
}

// The volume is 50% by default, but can be changed upon loading your config.
function setVolume(value)
{
	volume = parseInt(value) / 100;
	volNum.innerText = value + '%';
	
	if(value <= 0)
		volSpeaker.innerText = '🔈';
	else if(value < 50)
		volSpeaker.innerText = '🔉';
	else
		volSpeaker.innerText = '🔊';
	
	if(music && !music.isFading)
		music.gainNode.gain.value = volume;
}

function scrollVolume(e)
{
	let delta = event.deltaY;
	let direction = -delta / Math.abs(delta);
	let currentVolume = parseInt(e.value);
	
	// Go to the nearest number divisible by 5 like VLC.
	if(currentVolume % 5 !== 0)
	{
		let newVolume = currentVolume - (currentVolume % 5); // Floored value.
		
		if(direction > 0)
			newVolume += 5;
		
		e.value = newVolume;
	}
	else
		e.value = Math.max(Math.min(currentVolume + direction * 5, 100), 0);
	
	setVolume(e.value);
}

function toggleMusic(e)
{
	e.innerText = e.innerText === '⏸️' ? '▶️' : '⏸️';
	music && music.pause();
}

// '🔇'
function toggleMute()
{
	console.log('test');
}

function request(path, callback)
{
	let request = new XMLHttpRequest();
	request.open("GET", path);
	request.onload = function() {callback && callback(request.responseText)};
	request.send();
}