import { useLoaderData } from "@remix-run/react";

import {
  Table,
  TableCaption,
  TableHead,
  TableHeader,
  TableRow,
} from "~/components/ui/table";

import { loader } from "./admin.dinners.$dinnerId_.signups";

export default function DinnerSignupsPage() {
  const { event, responses } = useLoaderData<typeof loader>();

  return (
    <main className="mx-auto flex max-w-3xl grow flex-col gap-5 px-2 pb-8 pt-4 text-gray-800">
      <div className="flex items-center justify-between gap-2 rounded-md bg-secondary p-4 text-secondary-foreground">
        <p className="text-sm font-medium leading-none">
          You are viewing the submissons for the {`${event.title}`} dinner.
        </p>
      </div>
      <Table>
        <TableCaption>A list of your recent invoices.</TableCaption>
        <TableHeader>
          <TableRow>
            <TableHead className="w-[100px]">Invoice</TableHead>
            <TableHead>Status</TableHead>
            <TableHead>Method</TableHead>
            <TableHead className="text-right">Amount</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          <TableRow>
            <TableCell className="font-medium">INV001</TableCell>
            <TableCell>Paid</TableCell>
            <TableCell>Credit Card</TableCell>
            <TableCell className="text-right">$250.00</TableCell>
          </TableRow>
        </TableBody>
      </Table>
    </main>
  );
}
