"use client";

import React from "react";
import { Controller, useFormContext } from "react-hook-form";

type IdItem = { id: number };

export function RHFArrayIdField({
  name,
  render,
}: {
  name: string;
  render: (
    value: IdItem[],
    setValue: (next: IdItem[]) => void,
    error?: string,
  ) => React.ReactElement;
}) {
  const { control, setValue: rhfSetValue } = useFormContext();

  return (
    <Controller
      control={control}
      name={name}
      render={({ field, fieldState }) => {
        const safeValue: IdItem[] = Array.isArray(field.value)
          ? (field.value as IdItem[])
          : [];
        const setValue = (next: IdItem[]) => {
          field.onChange(next);
          rhfSetValue(name, next, {
            shouldDirty: true,
            shouldTouch: true,
            shouldValidate: false,
          });
        };
        return render(safeValue, setValue, fieldState.error?.message);
      }}
    />
  );
}
