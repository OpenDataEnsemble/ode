fn main() {
    // Re-embed Windows icon when `icons/icon.ico` changes (incremental builds may skip otherwise).
    println!("cargo:rerun-if-changed=icons/icon.ico");
    println!("cargo:rerun-if-changed=tauri.conf.json");
    tauri_build::build()
}
