use rodio::{Decoder, OutputStream, Sink, Source};
use std::fs::File;
use std::io::BufReader;
use std::sync::{Arc, Mutex};
use std::thread;
use std::time::Duration;
//use std::time::Instant;

pub fn play_intro_section(sink: Arc<Mutex<Sink>>, path: String) {
    thread::spawn(move || {
        let file = BufReader::new(
            File::open(&path).expect(&format!("Expected a file to exist at \"{}\".", &path)),
        );
        let source = Decoder::new(file).unwrap();
        let sink = &*sink.lock().unwrap();
        // The sink automatically starts playing after an audio source is appended.
        sink.append(source);
    });
}

/*pub fn play_looped_section(sink: Arc<Mutex<Sink>>, path: String) {
    thread::spawn(move || {
        let file = BufReader::new(
            File::open(&path).expect(&format!("Expected a file to exist at \"{}\".", &path)),
        );
        let source = Decoder::new(file).unwrap();
        let sink = &*sink.lock().unwrap();

        //sink.append(source.delay(Duration::from_secs(3)));
        sink1.append(source_intro);
        sink2.append(source_apollo.delay(Duration::from_millis(5581)));
        //sink3.append(source_apollo2.delay(Duration::from_millis(5581 + 65581)));
        //sink4.append(source_apollo3.delay(Duration::from_millis(5581 + (2 * 65581))));

        //sink.append(source.skip_duration(Duration::from_secs(3)));
        //sink.append(source.repeat_infinite());
    });
}*/

pub fn test() {
    thread::spawn(|| {
        // Get a output stream handle to the default physical sound device
        // Maybe use two common sinks then use locks on each sink within threads to avoid creating new sinks every time?
        let (_stream, stream_handle) = OutputStream::try_default().unwrap();
        let sink1 = Sink::try_new(&stream_handle).unwrap();
        let sink2 = Sink::try_new(&stream_handle).unwrap();
        //let sink3 = Sink::try_new(&stream_handle).unwrap();
        //let sink4 = Sink::try_new(&stream_handle).unwrap();

        // Load a sound from a file, using a path relative to Cargo.toml
        //let file = BufReader::new(File::open("test.ogg").unwrap());
        let intro = BufReader::new(File::open("muChallenge2-i.ogg").unwrap());
        let apollo = BufReader::new(File::open("muChallenge2.ogg").unwrap());
        //let apollo2 = BufReader::new(File::open("muChallenge2.ogg").unwrap());
        //let apollo3 = BufReader::new(File::open("muChallenge2.ogg").unwrap());

        // Decode that sound file into a source
        // Once the decoder has done its magic, this is the format you want to use for future instances of each loop. Clone it because appending a source to a sink consumes the data, avoid decoding a file again.
        //let source = Decoder::new(file).unwrap();
        //println!("Sample Rate: {} Hz", source.sample_rate());
        let source_intro = Decoder::new(intro).unwrap();
        let source_apollo = Decoder::new(apollo).unwrap();
        //let source_apollo2 = Decoder::new(apollo2).unwrap();
        //let source_apollo3 = Decoder::new(apollo3).unwrap();

        //sink.append(source.delay(Duration::from_secs(3)));
        sink1.append(source_intro);
        sink2.append(source_apollo.delay(Duration::from_millis(5581)));
        //sink3.append(source_apollo2.delay(Duration::from_millis(5581 + 65581)));
        //sink4.append(source_apollo3.delay(Duration::from_millis(5581 + (2 * 65581))));

        //sink.append(source.skip_duration(Duration::from_secs(3)));
        //sink.append(source.repeat_infinite());

        // The great thing about sleep_until_end() is that it'll take delays into account.
        //sink2.sleep_until_end();
        thread::sleep(Duration::from_secs(500));
        println!("end of thread");
    });
}
