// This is the structure that'll be passed between the main thread and the scheduler thread.
pub enum Action {
    Start,
    Play,
    Pause,
    Stop,
}

// Switch between different parts of the GUI.
pub enum Mode {
    Default,
}

impl Default for Mode {
    fn default() -> Self {
        Mode::Default
    }
}
