package stats

import (
	"testing"
	"time"
)

func utcDate(y int, m time.Month, d int) time.Time {
	return time.Date(y, m, d, 0, 0, 0, 0, time.UTC)
}

func TestBuildTimeline_Empty(t *testing.T) {
	tl := BuildTimeline(nil)
	if tl.BucketUnit != "day" {
		t.Fatalf("bucketUnit: got %q", tl.BucketUnit)
	}
	if tl.RangeStart != "" || tl.RangeEnd != "" {
		t.Fatalf("expected empty range, got %q–%q", tl.RangeStart, tl.RangeEnd)
	}
	if len(tl.Buckets) != 0 {
		t.Fatalf("expected no buckets, got %d", len(tl.Buckets))
	}
}

func TestBuildTimeline_SingleDay(t *testing.T) {
	tl := BuildTimeline([]DayCount{{Date: utcDate(2025, 1, 3), Count: 5}})
	if tl.BucketUnit != "day" {
		t.Fatalf("bucketUnit: got %q", tl.BucketUnit)
	}
	if tl.RangeStart != "2025-01-03" || tl.RangeEnd != "2025-01-03" {
		t.Fatalf("range: got %q–%q", tl.RangeStart, tl.RangeEnd)
	}
	if len(tl.Buckets) != 1 {
		t.Fatalf("buckets: got %d", len(tl.Buckets))
	}
	if tl.Buckets[0].Count != 5 || tl.Buckets[0].Label != "Jan 3" {
		t.Fatalf("bucket: %+v", tl.Buckets[0])
	}
}

func TestBuildTimeline_DayBucketsUnderOneYear(t *testing.T) {
	days := []DayCount{
		{Date: utcDate(2025, 1, 1), Count: 2},
		{Date: utcDate(2025, 1, 3), Count: 4},
	}
	tl := BuildTimeline(days)
	if tl.BucketUnit != "day" {
		t.Fatalf("bucketUnit: got %q", tl.BucketUnit)
	}
	if len(tl.Buckets) != 3 {
		t.Fatalf("expected 3 dense day buckets, got %d", len(tl.Buckets))
	}
	if tl.Buckets[0].Count != 2 || tl.Buckets[1].Count != 0 || tl.Buckets[2].Count != 4 {
		t.Fatalf("counts: %+v", tl.Buckets)
	}
}

func TestBuildTimeline_WeekBucketsAtOrOverOneYear(t *testing.T) {
	days := []DayCount{
		{Date: utcDate(2024, 1, 3), Count: 1}, // Wednesday
		{Date: utcDate(2025, 1, 3), Count: 2}, // Friday — span 366 days
	}
	tl := BuildTimeline(days)
	if tl.BucketUnit != "week" {
		t.Fatalf("bucketUnit: got %q want week", tl.BucketUnit)
	}
	if tl.RangeStart != "2024-01-01" { // Monday of first week
		t.Fatalf("rangeStart: got %q", tl.RangeStart)
	}
	if len(tl.Buckets) < 2 {
		t.Fatalf("expected multiple week buckets, got %d", len(tl.Buckets))
	}
	// First bucket should include the Jan 3 2024 count.
	if tl.Buckets[0].Count != 1 {
		t.Fatalf("first week count: got %d", tl.Buckets[0].Count)
	}
	last := tl.Buckets[len(tl.Buckets)-1]
	if last.Count != 2 {
		t.Fatalf("last week count: got %d", last.Count)
	}
}

func TestWeekStart_Monday(t *testing.T) {
	// 2025-01-05 is Sunday → week starts 2024-12-30
	got := weekStart(utcDate(2025, 1, 5))
	want := utcDate(2024, 12, 30)
	if !got.Equal(want) {
		t.Fatalf("weekStart Sunday: got %v want %v", got, want)
	}
	// 2025-01-06 is Monday → itself
	got = weekStart(utcDate(2025, 1, 6))
	want = utcDate(2025, 1, 6)
	if !got.Equal(want) {
		t.Fatalf("weekStart Monday: got %v want %v", got, want)
	}
}
