"use client";
import { Printer } from "lucide-react";
import { Button } from "@/components/ui/primitives";
export function PrintButton() { return <Button type="button" onClick={() => window.print()} className="no-print"><Printer className="me-2 h-4 w-4" aria-hidden />Print</Button>; }
