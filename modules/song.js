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
			// Cancel any ongoing fading so the user can instantly pause/resume but keep the value of this.fade.gain.value.
			// cancelAndHoldAtTime can be used but it doesn't work in Firefox.
			// So instead, cancelScheduledValues is used and the value is held to replicate that behavior.
			const heldValue = this.fade.gain.value;
			this.fade.gain.cancelScheduledValues(0);
			this.fade.gain.setValueAtTime(heldValue, 0);

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
			const heldValue = this.fade.gain.value;
			this.fade.gain.cancelScheduledValues(0);
			this.fade.gain.setValueAtTime(heldValue, 0);

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