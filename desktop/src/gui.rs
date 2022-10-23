use crate::music::test;
use crate::util::Action;
use crate::util::Mode;
use eframe::{egui, CreationContext};
use std::sync::mpsc::Sender;

pub struct App {
    mode: Mode,
    sender: Sender<Action>,
}

impl App {
    pub fn new(_cc: &CreationContext, sender: Sender<Action>) -> Self {
        Self {
            mode: Mode::Default,
            sender,
        }
    }
}

impl eframe::App for App {
    fn update(&mut self, ctx: &egui::Context, _frame: &mut eframe::Frame) {
        egui::CentralPanel::default().show(ctx, |ui| {
            match self.mode {
                Mode::Default => {
                    ui.heading("sample text");

                    if ui.button("start").clicked() {
                        self.sender
                            .send(Action::Start)
                            .expect("The scheduler thread should never close.");
                    }

                    if ui.button("play").clicked() {
                        self.sender
                            .send(Action::Play)
                            .expect("The scheduler thread should never close.");
                    }

                    if ui.button("pause").clicked() {
                        self.sender
                            .send(Action::Pause)
                            .expect("The scheduler thread should never close.");
                    }

                    if ui.button("stop").clicked() {
                        self.sender
                            .send(Action::Stop)
                            .expect("The scheduler thread should never close.");
                    }

                    if ui.button("test").clicked() {
                        test();
                    }
                }
            };
        });
    }
}
