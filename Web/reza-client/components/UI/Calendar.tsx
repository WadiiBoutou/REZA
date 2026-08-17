"use client"

import * as React from "react"
import { ChevronLeft, ChevronRight } from "lucide-react"
import { DayPicker, type DayPickerProps } from "react-day-picker"
import { cn } from "@/lib/utils"

export type CalendarProps = DayPickerProps & {
  locale?: any;
}

function Calendar({
  className,
  classNames,
  showOutsideDays = true,
  locale,
  ...props
}: CalendarProps) {
  return (
    <DayPicker
      showOutsideDays={showOutsideDays}
      className={cn("p-3", className)}
      classNames={{
        months: "flex flex-col sm:flex-row space-y-4 sm:space-x-4 sm:space-y-0",
        month: "space-y-4",
        month_caption: "flex justify-center pt-1 relative items-center",
        // Visible overlay label inside each dropdown (month / year) — styled as
        // an interactive pill. The native select sits invisibly underneath.
        caption_label: cn(
          "inline-flex items-center gap-1 rounded-lg border border-gray-200",
          "bg-white px-2.5 py-1.5 text-sm font-medium text-gray-900",
          "cursor-pointer transition-colors hover:border-gray-300 hover:bg-gray-50"
        ),
        nav: "space-x-1 flex items-center",
        button_previous: cn(
          "inline-flex items-center justify-center h-7 w-7 rounded-md border border-gray-200 bg-white text-gray-600 opacity-70 hover:opacity-100 hover:bg-gray-50 transition-opacity absolute left-1"
        ),
        button_next: cn(
          "inline-flex items-center justify-center h-7 w-7 rounded-md border border-gray-200 bg-white text-gray-600 opacity-70 hover:opacity-100 hover:bg-gray-50 transition-opacity absolute right-1"
        ),
        // ── Dropdown caption (captionLayout="dropdown") ──
        // The library renders a native <select> plus a styled label overlay.
        // The select must be invisible (absolute + opacity-0) and the label
        // overlay must sit on top — otherwise both show ("août août 2026 2026").
        dropdowns: "relative inline-flex items-center gap-1",
        dropdown_root: "relative inline-flex items-center",
        dropdown: cn(
          "absolute inset-0 w-full cursor-pointer appearance-none opacity-0",
          "m-0 p-0"
        ),
        months_dropdown: "",
        years_dropdown: "",
        chevron: "h-3 w-3 text-gray-400",
        month_grid: "w-full border-collapse space-y-1",
        weekdays: "flex",
        weekday: "text-gray-400 rounded-md w-9 font-normal text-[0.8rem] text-center",
        week: "flex w-full mt-2",
        day: cn(
          "h-9 w-9 text-center text-sm p-0 relative",
          "focus-within:relative focus-within:z-20"
        ),
        day_button: cn(
          "inline-flex items-center justify-center h-9 w-9 rounded-md text-sm font-normal",
          "text-gray-900 hover:bg-gray-100 transition-colors cursor-pointer",
          "aria-selected:opacity-100"
        ),
        range_end: "rounded-r-md",
        selected:
          "!bg-[#082259] !text-white hover:!bg-[#001a4d] focus:!bg-[#082259] rounded-md",
        today: "bg-gray-100 text-gray-900 font-semibold",
        outside: "text-gray-300 hover:bg-gray-50",
        disabled: "text-gray-300 opacity-50 cursor-not-allowed hover:bg-transparent",
        range_middle: "rounded-none",
        hidden: "invisible",
        ...classNames,
      }}
      components={{
        Chevron: ({ orientation }) =>
          orientation === "left" ? (
            <ChevronLeft className="h-4 w-4" />
          ) : (
            <ChevronRight className="h-4 w-4" />
          ),
      }}
      locale={locale as any}
      {...props}
    />
  )
}
Calendar.displayName = "Calendar"

export { Calendar }
