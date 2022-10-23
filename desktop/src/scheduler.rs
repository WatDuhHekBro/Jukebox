//use crate::music::play_intro_section;
use crate::util::Action;
use rodio::{Decoder, OutputStream, Sink};
use std::fs::File;
use std::io::BufReader;
use std::sync::mpsc::Receiver;
use std::thread;

pub fn start_scheduler(inbox: Receiver<Action>) {
    thread::spawn(move || {
        let mut running = true;

        // Get an output stream handle to the default physical sound device.
        let (_stream, stream_handle) =
            OutputStream::try_default().expect("There doesn't appear to be any playback device.");

        // Then create two common sinks to share between the loops.
        // Note: Due to [an issue with sink.stop()](https://github.com/RustAudio/rodio/issues/315), reassign the sink variables after stopping them. This seems to call the drop function and stops it automatically.
        let mut sink1 = Sink::try_new(&stream_handle).expect("Unable to create sink.");
        let mut sink2 = Sink::try_new(&stream_handle).expect("Unable to create sink.");

        while running {
            // The call to recv() here will make this thread wait indefinitely for input from the main thread.
            // It will fail if the main thread closes, which means the user exited the application.
            // This is just here so there isn't any unnecessary panic in the console when closing the application.
            match inbox.recv() {
                Ok(action) => match action {
                    Action::Start => {
                        println!("[ACTION] start");

                        // The actual scheduler starts here. What does it do?
                        // Starts sink1 immediately and starts sink2 with a delay.
                        // Sets a timeout for end of sink1, queues sink1 (section3).
                        // Sets a timeout for end of sink2, queues sink2 (section4).
                        // The sole purpose of these threads is to keep track of a timeout and not block the main thread, if the music is stopped, the next call to try_recv() from within will close the thread.
                        // > Ok(_) | Err(TryRecvError::Disconnected) => {break;}
                        // > Err(TryRecvError::Empty) => {}
                        // Send a message to the main thread to queue the next section.

                        // [More Brainstorming]
                        // Main thread: Pause/stop sinks then send a termination signal to children threads
                        // Child thread for timeout: When time's up, try_recv(), if no termination message, lock the sink, queue next section w/ delay, unlock the sink (within its own {} to auto drop)

                        //play_intro_section(Arc::clone(&sink1), String::from("muChallenge2-i.ogg"));
                        let path = "muChallenge2-i.ogg";
                        let file = BufReader::new(
                            File::open(path)
                                .expect(&format!("Expected a file to exist at \"{}\".", path)),
                        );
                        let source = Decoder::new(file).unwrap();
                        // The sink automatically starts playing after an audio source is appended.
                        sink1.append(source);
                    }
                    Action::Play => {
                        println!("[ACTION] play");
                        sink1.play();
                        sink2.play();
                    }
                    Action::Pause => {
                        println!("[ACTION] pause");
                        sink1.pause();
                        sink2.pause();
                    }
                    Action::Stop => {
                        println!("[ACTION] stop");
                        sink1 = Sink::try_new(&stream_handle).expect("Unable to create sink.");
                        sink2 = Sink::try_new(&stream_handle).expect("Unable to create sink.");
                    }
                },
                Err(_) => running = false,
            };
        }
    });
}
