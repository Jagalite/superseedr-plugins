package main

import (
	"encoding/json"
	"log"
	"os"

	"github.com/gofiber/fiber/v2"
	"github.com/gofiber/fiber/v2/middleware/cors"
	"github.com/gofiber/fiber/v2/middleware/logger"
)

// Duration represents a duration with seconds and nanoseconds
type Duration struct {
	Secs  int64 `json:"secs"`
	Nanos int64 `json:"nanos"`
}

// TorrentInfo contains all metrics for a single torrent
type TorrentInfo struct {
	TorrentControlState              string                 `json:"torrent_control_state"`
	InfoHash                         []int                  `json:"info_hash"`
	TorrentOrMagnet                  string                 `json:"torrent_or_magnet"`
	TorrentName                      string                 `json:"torrent_name"`
	DownloadPath                     string                 `json:"download_path"`
	ContainerName                    string                 `json:"container_name"`
	FilePriorities                   map[string]interface{} `json:"file_priorities"`
	NumberOfSuccessfullyConnectedPeers int                  `json:"number_of_successfully_connected_peers"`
	NumberOfPiecesTotal              int                    `json:"number_of_pieces_total"`
	NumberOfPiecesCompleted          int                    `json:"number_of_pieces_completed"`
	DownloadSpeedBps                 int64                  `json:"download_speed_bps"`
	UploadSpeedBps                   int64                  `json:"upload_speed_bps"`
	BytesDownloadedThisTick          int64                  `json:"bytes_downloaded_this_tick"`
	BytesUploadedThisTick            int64                  `json:"bytes_uploaded_this_tick"`
	ETA                              Duration               `json:"eta"`
	ActivityMessage                  string                 `json:"activity_message"`
	NextAnnounceIn                   Duration               `json:"next_announce_in"`
	TotalSize                        int64                  `json:"total_size"`
	BytesWritten                     int64                  `json:"bytes_written"`
	BlocksInThisTick                 int64                  `json:"blocks_in_this_tick"`
	BlocksOutThisTick                int64                  `json:"blocks_out_this_tick"`
}

// SettingsTorrent represents torrent configuration in settings
type SettingsTorrent struct {
	TorrentOrMagnet      string                 `json:"torrent_or_magnet"`
	Name                 string                 `json:"name"`
	ValidationStatus     bool                   `json:"validation_status"`
	DownloadPath         string                 `json:"download_path"`
	ContainerName        string                 `json:"container_name"`
	TorrentControlState  string                 `json:"torrent_control_state"`
	FilePriorities       map[string]interface{} `json:"file_priorities"`
}

// Settings contains system configuration
type Settings struct {
	ClientID                          string            `json:"client_id"`
	ClientPort                        int               `json:"client_port"`
	Torrents                          []SettingsTorrent `json:"torrents"`
	LifetimeDownloaded                int64             `json:"lifetime_downloaded"`
	LifetimeUploaded                  int64             `json:"lifetime_uploaded"`
	PrivateClient                     bool              `json:"private_client"`
	TorrentSortColumn                 string            `json:"torrent_sort_column"`
	TorrentSortDirection              string            `json:"torrent_sort_direction"`
	PeerSortColumn                    string            `json:"peer_sort_column"`
	PeerSortDirection                 string            `json:"peer_sort_direction"`
	WatchFolder                       *string           `json:"watch_folder"`
	DefaultDownloadFolder             string            `json:"default_download_folder"`
	MaxConnectedPeers                 int               `json:"max_connected_peers"`
	BootstrapNodes                    []string          `json:"bootstrap_nodes"`
	GlobalDownloadLimitBps            int64             `json:"global_download_limit_bps"`
	GlobalUploadLimitBps              int64             `json:"global_upload_limit_bps"`
	MaxConcurrentValidations          int               `json:"max_concurrent_validations"`
	ConnectionAttemptPermits          int               `json:"connection_attempt_permits"`
	ResourceLimitOverride             *int              `json:"resource_limit_override"`
	UploadSlots                       int               `json:"upload_slots"`
	PeerUploadInFlightLimit           int               `json:"peer_upload_in_flight_limit"`
	TrackerFallbackIntervalSecs       int               `json:"tracker_fallback_interval_secs"`
	ClientLeechingFallbackIntervalSecs int              `json:"client_leeching_fallback_interval_secs"`
	OutputStatusInterval              int               `json:"output_status_interval"`
}

// StatusResponse is the top-level response structure
type StatusResponse struct {
	RunTime            int64                  `json:"run_time"`
	CPUUsage           float64                `json:"cpu_usage"`
	RAMUsagePercent    float64                `json:"ram_usage_percent"`
	TotalDownloadBps   int64                  `json:"total_download_bps"`
	TotalUploadBps     int64                  `json:"total_upload_bps"`
	Torrents           map[string]TorrentInfo `json:"torrents"`
	Settings           Settings               `json:"settings"`
}

func main() {
	// Get configuration from environment variables
	statusFile := os.Getenv("STATUS_FILE")
	if statusFile == "" {
		statusFile = "superseedr_output_example.json"
	}

	port := os.Getenv("PORT")
	if port == "" {
		port = "8080"
	}

	// Create Fiber app
	app := fiber.New(fiber.Config{
		ErrorHandler: func(c *fiber.Ctx, err error) error {
			code := fiber.StatusInternalServerError
			if e, ok := err.(*fiber.Error); ok {
				code = e.Code
			}
			return c.Status(code).JSON(fiber.Map{
				"error": err.Error(),
			})
		},
	})

	// Middleware
	app.Use(logger.New())
	app.Use(cors.New(cors.Config{
		AllowOrigins: "*",
		AllowHeaders: "Origin, Content-Type, Accept",
		AllowMethods: "GET, OPTIONS",
	}))

	// Health check endpoint
	app.Get("/health", func(c *fiber.Ctx) error {
		return c.JSON(fiber.Map{
			"status": "ok",
		})
	})

	// Stats endpoint
	app.Get("/api/stats", func(c *fiber.Ctx) error {
		// Read the status file
		data, err := os.ReadFile(statusFile)
		if err != nil {
			if os.IsNotExist(err) {
				return c.Status(fiber.StatusServiceUnavailable).JSON(fiber.Map{
					"error":   "Status file not found",
					"message": "Superseedr may be starting up or the status file path is incorrect",
				})
			}
			return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{
				"error":   "Failed to read status file",
				"message": err.Error(),
			})
		}

		// Check if file is empty
		if len(data) == 0 {
			return c.Status(fiber.StatusServiceUnavailable).JSON(fiber.Map{
				"error":   "Status file is empty",
				"message": "Superseedr may be initializing",
			})
		}

		// Parse JSON
		var stats StatusResponse
		if err := json.Unmarshal(data, &stats); err != nil {
			return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{
				"error":   "Failed to parse status file",
				"message": err.Error(),
			})
		}

		return c.JSON(stats)
	})

	// Start server
	log.Printf("Starting Superseedr Web UI Backend on port %s", port)
	log.Printf("Reading status from: %s", statusFile)
	if err := app.Listen(":" + port); err != nil {
		log.Fatal(err)
	}
}
