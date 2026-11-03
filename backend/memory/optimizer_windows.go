//go:build windows

package memory

import (
	"os"
	"syscall"
	"unsafe"
)

var (
	kernel32                 = syscall.NewLazyDLL("kernel32.dll")
	procCreateToolhelp32Snap = kernel32.NewProc("CreateToolhelp32Snapshot")
	procProcess32First       = kernel32.NewProc("Process32FirstW")
	procProcess32Next        = kernel32.NewProc("Process32NextW")
	procSetProcessWorkingSet = kernel32.NewProc("SetProcessWorkingSetSize")
	procOpenProcess          = kernel32.NewProc("OpenProcess")
	procCloseHandle          = kernel32.NewProc("CloseHandle")
	psapi                    = syscall.NewLazyDLL("psapi.dll")
	procEmptyWorkingSet      = psapi.NewProc("EmptyWorkingSet")
)

const (
	TH32CS_SNAPPROCESS = 0x00000002
	PROCESS_SET_QUOTA  = 0x0100
	PROCESS_QUERY_INFO = 0x0400
)

type processEntry32W struct {
	Size            uint32
	CntUsage        uint32
	ProcessID       uint32
	DefaultHeapID   uintptr
	ModuleID        uint32
	CntThreads      uint32
	ParentProcessID uint32
	PriClassBase    int32
	Flags           uint32
	ExeFile         [260]uint16
}

func trimPlatformMemory() {
	currentPID := uint32(os.Getpid())

	// 1. Trim own process
	if hProc, err := syscall.GetCurrentProcess(); err == nil {
		_, _, _ = procEmptyWorkingSet.Call(uintptr(hProc))
		_, _, _ = procSetProcessWorkingSet.Call(uintptr(hProc), ^uintptr(0), ^uintptr(0))
	}

	// 2. Discover and trim child WebView2 processes
	hSnap, _, _ := procCreateToolhelp32Snap.Call(TH32CS_SNAPPROCESS, 0)
	if hSnap == uintptr(syscall.InvalidHandle) {
		return
	}
	defer procCloseHandle.Call(hSnap)

	var entry processEntry32W
	entry.Size = uint32(unsafe.Sizeof(entry))

	ret, _, _ := procProcess32First.Call(hSnap, uintptr(unsafe.Pointer(&entry)))
	if ret == 0 {
		return
	}

	// Track direct and indirect child PIDs
	childPIDs := make(map[uint32]bool)
	allProcesses := make([]processEntry32W, 0, 128)

	for {
		allProcesses = append(allProcesses, entry)
		if entry.ParentProcessID == currentPID {
			childPIDs[entry.ProcessID] = true
		}
		ret, _, _ = procProcess32Next.Call(hSnap, uintptr(unsafe.Pointer(&entry)))
		if ret == 0 {
			break
		}
	}

	// Find grandchild processes of child WebView2 processes (e.g. GPU / Utility)
	for _, p := range allProcesses {
		if childPIDs[p.ParentProcessID] {
			childPIDs[p.ProcessID] = true
		}
	}

	for pid := range childPIDs {
		desiredAccess := uintptr(PROCESS_SET_QUOTA | PROCESS_QUERY_INFO)
		hChild, _, _ := procOpenProcess.Call(desiredAccess, 0, uintptr(pid))
		if hChild != 0 && hChild != uintptr(syscall.InvalidHandle) {
			_, _, _ = procEmptyWorkingSet.Call(hChild)
			_, _, _ = procSetProcessWorkingSet.Call(hChild, ^uintptr(0), ^uintptr(0))
			_, _, _ = procCloseHandle.Call(hChild)
		}
	}
}
