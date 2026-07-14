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
        LoadLibraryA(b"kernel32.dll\0".as_ptr());
        LoadLibraryA(b"advapi32.dll\0".as_ptr());
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
