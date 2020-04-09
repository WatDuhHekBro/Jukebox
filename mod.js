let isPlaying = true;

function setSong(track)
{
	if(track)
	{
		new ig.EVENT_STEP.PLAY_BGM({bgm: track}).run();
		return Object.keys(ig.BGM_TRACK_LIST).includes(track) ? `"${track}" is a valid track.` : `"${track}" is not a valid track.`;
	}
	else
	{
		if(isPlaying)
		{
			new ig.EVENT_STEP.PAUSE_BGM({}).run();
			isPlaying = false;
			return "Paused the current track.";
		}
		else
		{
			new ig.EVENT_STEP.RESUME_BGM({mode: 'MEDIUM'}).run();
			isPlaying = true;
			return "Resumed the current track.";
		}
	}
}

function playRandom(selection)
{
	let tmp = selection || Object.keys(ig.BGM_TRACK_LIST);
	let track = tmp[getRandomInt(0, tmp.length)];
	new ig.EVENT_STEP.PLAY_BGM({bgm: track}).run();
	return `Randomly selected ${track}.`;
}

function getRandomInt(min, max)
{
	return Math.floor(Math.random() * (max - min)) + min;
}