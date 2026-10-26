import { ActionSheetIOS, Alert, Platform } from 'react-native';

export type MenuAction = { label: string; onPress: () => void; destructive?: boolean };

/**
 * Handlingsmeny for ⋯-knapper: systemets handlingsark på iOS (med «Avbryt» nederst), ellers en
 * dialog. Destruktive valg (som «Slett») vises i rødt.
 */
export function showActionMenu(title: string, actions: MenuAction[]) {
  if (Platform.OS === 'ios') {
    const destructive = actions.findIndex((a) => a.destructive);
    ActionSheetIOS.showActionSheetWithOptions(
      {
        title,
        options: [...actions.map((a) => a.label), 'Avbryt'],
        cancelButtonIndex: actions.length,
        destructiveButtonIndex: destructive >= 0 ? destructive : undefined,
      },
      (i) => actions[i]?.onPress(),
    );
    return;
  }
  Alert.alert(title, undefined, [
    ...actions.map((a) => ({ text: a.label, style: a.destructive ? ('destructive' as const) : ('default' as const), onPress: a.onPress })),
    { text: 'Avbryt', style: 'cancel' as const },
  ]);
}
