import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Info } from "lucide-react";

const SIZE_CHART_DATA = [
  { size: "S", chest: "36-38", waist: "28-30", length: "26" },
  { size: "M", chest: "38-40", waist: "30-32", length: "27" },
  { size: "L", chest: "40-42", waist: "32-34", length: "28" },
  { size: "XL", chest: "42-44", waist: "34-36", length: "29" },
  { size: "XXL", chest: "44-46", waist: "36-38", length: "30" },
];

interface SizeChartProps {
  trigger?: React.ReactNode;
}

export default function SizeChart({ trigger }: SizeChartProps) {
  return (
    <Dialog>
      <DialogTrigger asChild>
        {trigger || (
          <Button variant="ghost" size="sm" className="text-xs">
            <Info className="w-3 h-3 mr-1" />
            Size Chart
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Size Chart</DialogTitle>
          <DialogDescription>
            All measurements are in inches. For the best fit, measure yourself and compare with the chart below.
          </DialogDescription>
        </DialogHeader>
        
        <div className="space-y-4">
          <div className="overflow-hidden rounded-lg border">
            <table className="w-full">
              <thead className="bg-muted/50">
                <tr>
                  <th className="px-3 py-2 text-left text-xs font-medium">Size</th>
                  <th className="px-3 py-2 text-left text-xs font-medium">Chest</th>
                  <th className="px-3 py-2 text-left text-xs font-medium">Waist</th>
                  <th className="px-3 py-2 text-left text-xs font-medium">Length</th>
                </tr>
              </thead>
              <tbody>
                {SIZE_CHART_DATA.map((row, index) => (
                  <tr key={row.size} className={index % 2 === 0 ? "bg-background" : "bg-muted/25"}>
                    <td className="px-3 py-2 font-medium">{row.size}</td>
                    <td className="px-3 py-2 text-sm">{row.chest}</td>
                    <td className="px-3 py-2 text-sm">{row.waist}</td>
                    <td className="px-3 py-2 text-sm">{row.length}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          
          <div className="space-y-2 text-xs text-muted-foreground">
            <h4 className="font-medium text-foreground">How to Measure:</h4>
            <ul className="space-y-1 list-disc list-inside">
              <li><strong>Chest:</strong> Measure around the fullest part of your chest</li>
              <li><strong>Waist:</strong> Measure around your natural waistline</li>
              <li><strong>Length:</strong> Measure from shoulder to bottom hem</li>
            </ul>
            <p className="mt-2">
              <strong>Note:</strong> Sizes may vary slightly depending on fabric and style. 
              When in doubt, size up for a more comfortable fit.
            </p>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}