package stats

import (
	"time"
)

// BuildTimeline turns sparse per-day counts into a dense day/week histogram.
// Matches Desktop overview semantics: span >= 365 days → weekly (Monday start),
// else daily; zero-filled buckets; labels like "Jan 3".
func BuildTimeline(days []DayCount) ObservationTimeline {
	if len(days) == 0 {
		return ObservationTimeline{
			BucketUnit: "day",
			RangeStart: "",
			RangeEnd:   "",
			Buckets:    []TimelineBucket{},
		}
	}

	minDate := days[0].Date
	maxDate := days[0].Date
	for _, d := range days[1:] {
		if d.Date.Before(minDate) {
			minDate = d.Date
		}
		if d.Date.After(maxDate) {
			maxDate = d.Date
		}
	}

	spanDays := int(maxDate.Sub(minDate).Hours() / 24)
	useWeeks := spanDays >= 365

	counts := make(map[string]int64, len(days))
	for _, d := range days {
		key := d.Date
		if useWeeks {
			key = weekStart(d.Date)
		}
		counts[key.Format("2006-01-02")] += d.Count
	}

	var rangeStart, rangeEnd time.Time
	var stepDays int
	if useWeeks {
		rangeStart = weekStart(minDate)
		rangeEnd = weekStart(maxDate)
		stepDays = 7
	} else {
		rangeStart = minDate
		rangeEnd = maxDate
		stepDays = 1
	}

	buckets := make([]TimelineBucket, 0)
	for cursor := rangeStart; !cursor.After(rangeEnd); cursor = cursor.AddDate(0, 0, stepDays) {
		key := cursor.Format("2006-01-02")
		buckets = append(buckets, TimelineBucket{
			BucketStart: key,
			Label:       formatDayLabel(cursor),
			Count:       counts[key],
		})
	}

	unit := "day"
	if useWeeks {
		unit = "week"
	}

	return ObservationTimeline{
		BucketUnit: unit,
		RangeStart: rangeStart.Format("2006-01-02"),
		RangeEnd:   rangeEnd.Format("2006-01-02"),
		Buckets:    buckets,
	}
}

func weekStart(date time.Time) time.Time {
	// Monday-start week (ISO-like), matching Desktop chrono::weekday().num_days_from_monday().
	wd := int(date.Weekday())
	if wd == 0 {
		wd = 7 // Sunday → 7
	}
	return date.AddDate(0, 0, -(wd - 1))
}

func formatDayLabel(date time.Time) string {
	// "Jan 3" — day without leading zero (matches Desktop format_day_label).
	return date.Format("Jan") + " " + date.Format("2")
}
