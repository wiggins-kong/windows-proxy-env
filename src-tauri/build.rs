fn main() {
    // 前端资源由 Tauri 在 Rust 编译期嵌入，必须把 ui/ 纳入 Cargo 的变更检测。
    println!("cargo:rerun-if-changed=../ui");
    tauri_build::build()
}
