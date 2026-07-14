import pefile
import os
import subprocess
import shutil

EXE_PATH = r"F:\Vanya\topos\src-tauri\target\i686-pc-windows-msvc\release\app.exe"
PORTABLE_DIR = r"F:\Vanya\topos\topos_portable_x86"
TOPOS_EXE = os.path.join(PORTABLE_DIR, "topos.exe")

if not os.path.exists(PORTABLE_DIR):
    os.makedirs(PORTABLE_DIR)

shutil.copyfile(EXE_PATH, TOPOS_EXE)
print(f"Copied {EXE_PATH} -> {TOPOS_EXE}")

pe = pefile.PE(EXE_PATH)

advapi_funcs = []
kernel_funcs = []

for entry in pe.DIRECTORY_ENTRY_IMPORT:
    dll_name = entry.dll.decode('utf-8', errors='ignore').upper()
    if dll_name == 'ADVAPI32.DLL':
        for imp in entry.imports:
            if imp.name:
                advapi_funcs.append(imp.name.decode('utf-8'))
    elif dll_name == 'KERNEL32.DLL':
        for imp in entry.imports:
            if imp.name:
                kernel_funcs.append(imp.name.decode('utf-8'))

pe.close()

print(f"Found {len(advapi_funcs)} imports from ADVAPI32.DLL")
print(f"Found {len(kernel_funcs)} imports from KERNEL32.DLL")
advapi_stubs = {'EventSetInformation'}
with open("winadv32.def", "w") as f:
    f.write("LIBRARY winadv32\nEXPORTS\n")
    for name in sorted(set(advapi_funcs)):
        if name in advapi_stubs:
            f.write(f"    {name} = Stub_{name}\n")
        else:
            f.write(f"    {name} = advapi32.{name}\n")
kernel_stubs = {
    'GetSystemTimePreciseAsFileTime',
    'WaitOnAddress',
    'WakeByAddressAll',
    'WakeByAddressSingle',
    'SetFileInformationByHandle'
}
with open("winker32.def", "w") as f:
    f.write("LIBRARY winker32\nEXPORTS\n")
    for name in sorted(set(kernel_funcs)):
        if name in kernel_stubs:
            f.write(f"    {name} = Stub_{name}\n")
        else:
            f.write(f"    {name} = kernel32.{name}\n")
rust_src = """#![no_main]
fn panic(_info: &core::panic::PanicInfo) -> ! {
    loop {}
}
extern "C" {}
extern "C" {}
extern "system" {
    fn SystemFunction036(pb_buffer: *mut u8, cb_buffer: u32) -> u8;
}
extern "system" {
    fn GetSystemTimeAsFileTime(lp_time: *mut u64);
    fn Sleep(dw_milliseconds: u32);
    fn LoadLibraryA(lp_lib_file_name: *const u8) -> *mut u8;
    fn IsBadReadPtr(lp_ptr: *const u8, ucb: usize) -> i32;
}
pub unsafe extern "system" fn _DllMainCRTStartup(_hinst: *mut u8, reason: u32, _reserved: *mut u8) -> i32 {
    if reason == 1 { 
        LoadLibraryA(b"kernel32.dll\\0".as_ptr());
        LoadLibraryA(b"advapi32.dll\\0".as_ptr());
    }
    1
}
pub unsafe extern "system" fn ProcessPrng(pb_buffer: *mut u8, cb_buffer: usize) -> i32 {
    if pb_buffer.is_null() || cb_buffer == 0 {
        return 1;
    }
    let mut offset = 0;
    while offset < cb_buffer {
        let chunk = core::cmp::min(cb_buffer - offset, u32::MAX as usize) as u32;
        if SystemFunction036(pb_buffer.add(offset), chunk) == 0 {
            return 0;
        }
        offset += chunk as usize;
    }
    1
}
pub unsafe extern "system" fn Stub_EventSetInformation(
    _reg_handle: u64,
    _info_class: u32,
    _event_info: *const u8,
    _info_size: u32,
) -> u32 {
    0 
}
pub unsafe extern "system" fn Stub_GetSystemTimePreciseAsFileTime(lp_time: *mut u64) {
    if !lp_time.is_null() && IsBadReadPtr(lp_time as *const u8, 8) == 0 {
        GetSystemTimeAsFileTime(lp_time);
    }
}
pub unsafe extern "system" fn Stub_WaitOnAddress(
    address: *mut u8,
    compare_address: *mut u8,
    address_size: usize,
    dw_milliseconds: u32,
) -> i32 {
    if address.is_null() || compare_address.is_null() || address_size == 0 {
        return 0;
    }
    if IsBadReadPtr(address as *const u8, address_size) != 0 || IsBadReadPtr(compare_address as *const u8, address_size) != 0 {
        return 0;
    }
    let mut differs = false;
    for i in 0..address_size {
        if *address.add(i) != *compare_address.add(i) {
            differs = true;
            break;
        }
    }

    if differs {
        return 1; 
    }
    let sleep_ms = if dw_milliseconds == u32::MAX { 10 } else { core::cmp::min(dw_milliseconds, 10) };
    Sleep(sleep_ms);
    0
}
pub unsafe extern "system" fn Stub_WakeByAddressAll(_address: *mut u8) {}
pub unsafe extern "system" fn Stub_WakeByAddressSingle(_address: *mut u8) {}
pub unsafe extern "system" fn Stub_SetFileInformationByHandle(
    _file: *mut u8,
    _class: u32,
    _info: *mut u8,
    _size: u32,
) -> i32 {
    1 
}
"""

with open("shims.rs", "w") as f:
    f.write(rust_src)

print("Compiling shims...")
subprocess.check_call([
    "rustc", "-C", "panic=abort", "--crate-type", "cdylib", "--target", "i686-pc-windows-msvc",
    "-C", "link-arg=msvcrt.lib", "-C", "link-arg=vcruntime.lib", "-C", "link-arg=/ENTRY:_DllMainCRTStartup@12",
    "shims.rs", "-o", os.path.join(PORTABLE_DIR, "bcryptprimitives.dll")
])
subprocess.check_call([
    "rustc", "-C", "panic=abort", "--crate-type", "cdylib", "--target", "i686-pc-windows-msvc",
    "-C", "link-arg=msvcrt.lib", "-C", "link-arg=vcruntime.lib", "-C", "link-arg=/ENTRY:_DllMainCRTStartup@12",
    "-C", f"link-arg=/DEF:winadv32.def",
    "shims.rs", "-o", os.path.join(PORTABLE_DIR, "winadv32.dll")
])
subprocess.check_call([
    "rustc", "-C", "panic=abort", "--crate-type", "cdylib", "--target", "i686-pc-windows-msvc",
    "-C", "link-arg=msvcrt.lib", "-C", "link-arg=vcruntime.lib", "-C", "link-arg=/ENTRY:_DllMainCRTStartup@12",
    "-C", f"link-arg=/DEF:winker32.def",
    "shims.rs", "-o", os.path.join(PORTABLE_DIR, "winker32.dll")
])

print("Shims compiled successfully!")
data = open(TOPOS_EXE, "rb").read()
data_patched = data.replace(b"ADVAPI32.dll\x00", b"WINADV32.dll\x00").replace(b"advapi32.dll\x00", b"WINADV32.dll\x00")
data_patched = data_patched.replace(b"KERNEL32.dll\x00", b"WINKER32.dll\x00").replace(b"kernel32.dll\x00", b"WINKER32.dll\x00")

open(TOPOS_EXE, "wb").write(data_patched)
print("PE binary patched successfully!")
