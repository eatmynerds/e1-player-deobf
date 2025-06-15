use log::info;
use std::{error::Error, result::Result, thread, time::Duration};
use subprocess::{Exec, Redirection};

#[derive(Debug)]
pub enum KeyError {
    RequestError(reqwest::Error),
    FileError(Box<dyn Error>),
    CaptureError(subprocess::PopenError),
}

fn main() -> Result<(), KeyError> {
    simple_logger::SimpleLogger::new()
        .env()
        .with_level(log::LevelFilter::Info)
        .without_timestamps()
        .init()
        .unwrap();


    let mut first_loop = false;

    loop {
        info!("Fetching embed1 file (https://cloudvidz.net/js/player/m/v2/pro/embed-1.min.js)");

        let result =
            reqwest::blocking::get("https://cloudvidz.net/js/player/m/v2/pro/embed-1.min.js");

        match result {
            Ok(response) => {
                let script = response.text().map_err(KeyError::RequestError)?;

                if !first_loop {
                    first_loop = true;
                    if !std::path::Path::new("./e1-cache").exists() {
                        info!("E1-cache directory not found! Creating..");
                        let _ = std::fs::create_dir("e1-cache");
                    } else {
                        info!("E1-cache directory found!");
                    }

                    info!("Writing new temp.js file (e1-cache/temp.js)");
                    std::fs::write("e1-cache/temp.js", script.clone())
                        .map_err(|e| KeyError::FileError(Box::new(e)))?;
                }

                info!("Sleeping for (5) seconds");
                thread::sleep(Duration::from_secs(5));
                info!("Comparing e1 scripts..");
                if sha256::digest(script)
                    != sha256::digest(
                        std::fs::read_to_string("./e1-cache/temp.js")
                            .map_err(|e| KeyError::FileError(Box::new(e)))?,
                    )
                {
                    info!("Hash is different! Running update script..");
                    info!("Deleting previous e1-cache directory..");
                    std::fs::remove_dir_all("./e1-cache")
                        .map_err(|e| KeyError::FileError(Box::new(e)))?;

                    first_loop = false;

                    info!("Running update script");
                    Exec::cmd("./update.sh")
                        .stdout(Redirection::Pipe)
                        .capture()
                        .map_err(KeyError::CaptureError)?
                        .stdout_str();
                }
            }
            Err(_) => {}
        }
    }
}
