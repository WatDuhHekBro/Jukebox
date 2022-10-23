// Hide console window on Windows in release
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

mod gui;
mod music;
mod scheduler;
mod util;

use crate::gui::App;
use crate::scheduler::start_scheduler;
use std::sync::mpsc::channel;

//use std::time::Instant;

// Sometime during creation of GUI, the main background thread is created to manage sinks (yes, multiple).
// The GUI communicates instructions with this thread via a channel, no new threads are ever directly created by the GUI.
// The main background thread creates a new thread per loop, as this is the scheduler thread. Each sink thread will end when the loop ends.
// Problem: How do you start an audio file already at a specific time?

// Universal Format: vars [start, end, looped: bool, format: "time"|"samples"], audioFile[] (could be looped or not, if not looped, plays the next index when "end" is reached)
// Now that I think about it, two files will be the maximum needed as you only need an intro section to tie into the looped section, no more files afterward.
// This will take care of multiple files from CC & RPGMaker as well as looped files with nus3audio. If using samples, sample rate will need to be fetched.
// The main background / scheduler thread should store the initial system time in order to have a consistent base point in time. This is probably how the WebAudio API keeps track of "absolute" time.

// If issues ever arise over inaccurate looping, consider using [spin-sleep](https://github.com/alexheretic/spin-sleep).

// The problem with using repeat_infinite() built into the rodio library is that it ends at the end of the audio file, not when the loop itself ends. Some looped audio files are setup to have an ending part of the loop that plays as the loop continues, usually for extra percussion.

// Reference Point Math:
// a = base
// x = arbitrary time elapsed since a

// Reference Point Example/Brainstorming: intro section = 5.581s and main section = 65.581s, intro and loop1 are queued in 2 starter threads, no reference point needed.
// loop2 is queued at end of intro thread, delay is 5.581 + (65.581 * 2). Given an arbitrary point in time x (where intro audio file actually ends), the delay is (5.581 + (65.581 * 2)) - x (current elapsed time).

// Get the sample rate via "source.sample_rate()" to work with sample rate loop points.

fn main() {
    /*let time = Instant::now();
    thread::sleep(Duration::from_secs(5));
    let time2 = Instant::now();
    let time3 = time2.duration_since(time);
    println!("passed: {time3:?}");*/

    // The scheduler thread will listen for commands from the GUI (main) thread.
    let (tx, rx) = channel();

    // Start the scheduler thread, which manages commands for the audio.
    start_scheduler(rx);

    // Starts the GUI for the main thread.
    eframe::run_native(
        &format!("Jukebox (v{})", env!("CARGO_PKG_VERSION")),
        eframe::NativeOptions::default(),
        Box::new(|cc| Box::new(App::new(cc, tx))),
    );
}
