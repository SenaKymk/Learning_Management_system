import { forwardRef } from "react";
import { StyleSheet, Text, TextInput, TextInputProps, View } from "react-native";
import { useTheme } from "../theme/theme";

type Props = TextInputProps & {
  label?: string;
  error?: string | null;
};

const TextField = forwardRef<TextInput, Props>(({ label, error, style, ...props }, ref) => {
  const { colors } = useTheme();
  const styles = makeStyles(colors);
  return (
    <View style={styles.wrapper}>
      {label ? <Text style={styles.label}>{label}</Text> : null}
      <TextInput
        ref={ref}
        placeholderTextColor={colors.muted}
        style={[styles.input, style]}
        accessibilityLabel={label ?? props.placeholder ?? "Input"}
        {...props}
      />
      {error ? <Text style={styles.error}>{error}</Text> : null}
    </View>
  );
});

TextField.displayName = "TextField";

export default TextField;

const makeStyles = (colors: {
  text: string;
  border: string;
  danger: string;
  muted: string;
  surface: string;
}) =>
  StyleSheet.create({
    wrapper: {
      marginBottom: 12
    },
    label: {
      color: colors.text,
      marginBottom: 6,
      fontWeight: "600"
    },
    input: {
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 10,
      paddingHorizontal: 12,
      paddingVertical: 10,
      color: colors.text,
      backgroundColor: colors.surface
    },
    error: {
      color: colors.danger,
      marginTop: 4,
      fontSize: 12
    }
  });
