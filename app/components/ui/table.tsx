import type { ClassValue } from "clsx";
import React from "react";

import { cn } from "~/lib/utils";

type ElementProps<T> = {
  className?: string | ClassValue[];
  ref?: React.Ref<T>;
};

const Table = ({
  className,
  ref,
  ...props
}: React.TableHTMLAttributes<HTMLTableElement> &
  ElementProps<HTMLTableElement>) => (
  <div className="relative w-full overflow-auto">
    <table
      ref={ref}
      className={cn("w-full caption-bottom text-sm", className)}
      {...props}
    />
  </div>
);

Table.displayName = "Table";

const TableHeader = ({
  className,
  ref,
  ...props
}: React.HTMLAttributes<HTMLTableSectionElement> &
  ElementProps<HTMLTableSectionElement>) => (
  <thead ref={ref} className={cn("[&_tr]:border-b", className)} {...props} />
);

TableHeader.displayName = "TableHeader";

const TableBody = ({
  className,
  ref,
  ...props
}: React.HTMLAttributes<HTMLTableSectionElement> &
  ElementProps<HTMLTableSectionElement>) => (
  <tbody
    ref={ref}
    className={cn("[&_tr:last-child]:border-0", className)}
    {...props}
  />
);

TableBody.displayName = "TableBody";

const TableFooter = ({
  className,
  ref,
  ...props
}: React.HtmlHTMLAttributes<HTMLTableSectionElement> &
  ElementProps<HTMLTableSectionElement>) => (
  <tfoot
    ref={ref}
    className={cn(
      "bg-muted/50 border-t font-medium last:[&>tr]:border-b-0",
      className,
    )}
    {...props}
  />
);

TableFooter.displayName = "TableFooter";

const TableRow = ({
  className,
  ref,
  ...props
}: React.HtmlHTMLAttributes<HTMLTableRowElement> &
  ElementProps<HTMLTableRowElement>) => (
  <tr
    ref={ref}
    className={cn(
      "hover:bg-muted/50 data-[state=selected]:bg-muted border-b transition-colors",
      className,
    )}
    {...props}
  />
);

TableRow.displayName = "TableRow";

const TableHead = ({
  className,
  ref,
  ...props
}: React.ThHTMLAttributes<HTMLTableCellElement> &
  ElementProps<HTMLTableCellElement>) => (
  <th
    ref={ref}
    className={cn(
      "text-muted-foreground h-10 px-2 text-left align-middle font-medium [&:has([role=checkbox])]:pr-0 [&>[role=checkbox]]:translate-y-[2px]",
      className,
    )}
    {...props}
  />
);

TableHead.displayName = "TableHead";

const TableCell = ({
  className,
  ref,
  ...props
}: React.TdHTMLAttributes<HTMLTableCellElement> &
  ElementProps<HTMLTableCellElement>) => (
  <td
    ref={ref}
    className={cn(
      "p-2 align-middle [&:has([role=checkbox])]:pr-0 [&>[role=checkbox]]:translate-y-[2px]",
      className,
    )}
    {...props}
  />
);

TableCell.displayName = "TableCell";

const TableCaption = ({
  className,
  ref,
  ...props
}: React.HtmlHTMLAttributes<HTMLTableCaptionElement> &
  ElementProps<HTMLTableCaptionElement>) => (
  <caption
    ref={ref}
    className={cn("text-muted-foreground mt-4 text-sm", className)}
    {...props}
  />
);

TableCaption.displayName = "TableCaption";

export {
  Table,
  TableBody,
  TableCaption,
  TableCell,
  TableFooter,
  TableHead,
  TableHeader,
  TableRow,
};
