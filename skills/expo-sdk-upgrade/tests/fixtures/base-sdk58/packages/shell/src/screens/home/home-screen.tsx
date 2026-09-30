// packages/shell/src/screens/home/home-screen.tsx
import { Modal, View } from 'react-native';

type HomeScreenProps = { readonly isMenuOpen: boolean };

export function HomeScreen({ isMenuOpen }: HomeScreenProps): React.JSX.Element {
  return (
    <View>
      <Modal visible={isMenuOpen} animationType="fade" transparent>
        <View />
      </Modal>
    </View>
  );
}
