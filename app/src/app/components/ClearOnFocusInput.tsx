import React, { useEffect, useRef } from "react";
import { TextInput, TextInputProps } from "react-native";

/**
 * A TextInput that clears itself on the FIRST tap (focus) when a `defaultValue`
 * is provided. Subsequent taps leave the user's typed value intact.
 *
 * - First focus  → field clears so the user can type immediately.
 * - Blur empty   → `defaultValue` is restored; next focus will clear again.
 * - Parent reset → when the value prop returns to `defaultValue` while the field
 *                  is not focused (e.g. after submitting), the "first tap" window
 *                  resets so the next focus clears again.
 */
interface ClearOnFocusInputProps extends Omit<TextInputProps, "defaultValue"> {
  /** The initial / placeholder value to clear on first focus and restore on empty blur. */
  defaultValue?: string;
}

export function ClearOnFocusInput({
  value,
  onChangeText,
  defaultValue,
  onFocus,
  onBlur,
  ...props
}: ClearOnFocusInputProps) {
  // true once the user has focused the field since the last reset
  const hasBeenActivatedRef = useRef(false);
  // tracks whether the field is currently focused so we can distinguish
  // "user typed the default value" from "parent reset the value externally"
  const isFocusedRef = useRef(false);

  // When the value returns to defaultValue while NOT focused it means the parent
  // reset the field (e.g. after adding food). Treat it as fresh so the next
  // focus will clear again.
  useEffect(() => {
    if (!isFocusedRef.current && value === defaultValue) {
      hasBeenActivatedRef.current = false;
    }
  }, [value, defaultValue]);

  const handleFocus = (e: Parameters<NonNullable<TextInputProps["onFocus"]>>[0]) => {
    isFocusedRef.current = true;
    if (defaultValue !== undefined && !hasBeenActivatedRef.current) {
      hasBeenActivatedRef.current = true;
      onChangeText?.("");
    }
    onFocus?.(e);
  };

  const handleBlur = (e: Parameters<NonNullable<TextInputProps["onBlur"]>>[0]) => {
    isFocusedRef.current = false;
    if (defaultValue !== undefined && !value) {
      onChangeText?.(defaultValue);
      // hasBeenActivatedRef will be reset by the useEffect above when the
      // value prop updates to defaultValue after this onChangeText call
    }
    onBlur?.(e);
  };

  return (
    <TextInput
      value={value}
      onChangeText={onChangeText}
      onFocus={handleFocus}
      onBlur={handleBlur}
      {...props}
    />
  );
}
