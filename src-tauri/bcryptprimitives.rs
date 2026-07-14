#![no_main]
#![no_std]

#[panic_handler]
fn panic(_info: &core::panic::PanicInfo) -> ! {
    loop {}
}

#[link(name = "advapi32")]
extern "system" {
    fn SystemFunction036(pb_buffer: *mut u8, cb_buffer: u32) -> u8;
}

#[no_mangle]
pub unsafe extern "system" fn ProcessPrng(pb_buffer: *mut u8, cb_buffer: usize) -> i32 {
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
