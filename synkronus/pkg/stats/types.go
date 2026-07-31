package stats

import "time"

// ObservationStats is the aggregate payload for dashboard charts.
type ObservationStats struct {
	TotalCount int64               `json:"totalCount"`
	ByFormType []FormTypeCount     `json:"byFormType"`
	Timeline   ObservationTimeline `json:"timeline"`
	ComputedAt time.Time           `json:"computedAt"`
}

// FormTypeCount is a single form-type slice of the observation total.
type FormTypeCount struct {
	FormType string `json:"formType"`
	Count    int64  `json:"count"`
}

// ObservationTimeline is a dense day- or week-bucketed activity histogram.
type ObservationTimeline struct {
	BucketUnit string           `json:"bucketUnit"` // "day" | "week"
	RangeStart string           `json:"rangeStart"` // YYYY-MM-DD or empty
	RangeEnd   string           `json:"rangeEnd"`   // YYYY-MM-DD or empty
	Buckets    []TimelineBucket `json:"buckets"`
}

// TimelineBucket is one bar in the activity histogram.
type TimelineBucket struct {
	BucketStart string `json:"bucketStart"` // YYYY-MM-DD
	Label       string `json:"label"`       // e.g. "Jan 3"
	Count       int64  `json:"count"`
}

// DayCount is a per-UTC-day observation count from the database.
type DayCount struct {
	Date  time.Time // date-only (UTC midnight)
	Count int64
}
