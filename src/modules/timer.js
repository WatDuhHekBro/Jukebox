"use strict";

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