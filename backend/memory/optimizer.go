package memory

import (
	"os"
	"path/filepath"
	"runtime"
	"runtime/debug"
	"strings"
	"syscall"
	"time"
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
	Size              uint32
	CntUsage          uint32
	ProcessID         uint32
	DefaultHeapID     uintptr
	ModuleID          uint32
	CntThreads        uint32
	ParentProcessID   uint32
	PriClassBase      int32
	Flags             uint32
	ExeFile           [260]uint16
}

// ConfigureEnvironment sets low-memory limits for Go runtime and WebView2/Chromium
func ConfigureEnvironment() {
	// 1. Soft memory limit for Go runtime (128 MB)
	debug.SetMemoryLimit(128 * 1024 * 1024)

	// 2. More aggressive Go GC target (GC starts when heap grows by 50% rather than 100%)
	debug.SetGCPercent(50)

	// 3. Low-memory flags for WebView2 Chromium processes
	flags := []string{
		"--js-flags=--max-old-space-size=128",
		"--renderer-process-limit=1",
		"--disable-features=SpareRendererForSitePerProcess,OptimizationHints,MediaRouter,CalculateNativeWinOcclusion",
		"--enable-low-end-device-mode",
		"--disable-gpu-shader-disk-cache",
		"--disable-background-networking",
		"--disable-component-update",
		"--disable-domain-reliability",
	}

	existing := os.Getenv("WEBVIEW2_ADDITIONAL_BROWSER_ARGUMENTS")
	var combined []string
	if existing != "" {
		combined = append(combined, existing)
	}
	for _, f := range flags {
		flagPrefix := strings.Split(f, "=")[0]
		if !strings.Contains(existing, flagPrefix) {
			combined = append(combined, f)
		}
	}
	_ = os.Setenv("WEBVIEW2_ADDITIONAL_BROWSER_ARGUMENTS", strings.Join(combined, " "))
}

// TrimMemory forces Go GC, releases OS virtual memory, and trims Windows working sets
func TrimMemory() {
	// Go runtime memory release
	runtime.GC()
	debug.FreeOSMemory()

	// Windows process working set trimming
	if runtime.GOOS == "windows" {
		trimWindowsWorkingSets()
	}
}

// StartPeriodicOptimization starts a background loop trimming memory periodically
func StartPeriodicOptimization(interval time.Duration) {
	if interval <= 0 {
		interval = 45 * time.Second
	}
	go func() {
		ticker := time.NewTicker(interval)
		defer ticker.Stop()
		for range ticker.C {
			TrimMemory()
		}
	}()
}

func trimWindowsWorkingSets() {
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

func init() {
	// Ensure executable path or environment is prepped
	_ = filepath.Clean
}
