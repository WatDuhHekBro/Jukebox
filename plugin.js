export default class MusicPlayer extends Plugin
{
	constructor(mod)
	{
		super(mod);
		this.MOD_NAME = mod.name;
		this.BASE_DIR = mod.baseDirectory;
		this.RELATIVE_DIR = this.BASE_DIR.substring(7);
		this.SETTINGS_FILE = "settings.json";
	}
	
	async preload() {}
	async postload() {this.SETTINGS = await this._loadJSON(this.RELATIVE_DIR + this.SETTINGS_FILE);}
	async prestart() {ig.Bgm.preloadStartTrack(this.SETTINGS.song in ig.BGM_TRACK_LIST ? this.SETTINGS.song : "title");}
	
	async _loadJSON(path)
	{
		return $.ajax({
			dataType: 'json',
			url: path,
			success: (val) => {return val;},
			error: (xhr) => {console.error(`Error ${xhr.status}: Could not load "${path}"`);}
		});
	}
}