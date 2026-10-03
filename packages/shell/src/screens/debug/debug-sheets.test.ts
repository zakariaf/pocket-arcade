// packages/shell/src/screens/debug/debug-sheets.test.ts
// The OS sheets are replaced by spies that answer like the user would (a button index).
import { ActionSheetIOS, Share } from 'react-native';

import { DEBUG_SHEETS } from './debug-sheets.ts';

type SheetOptions = Parameters<typeof ActionSheetIOS.showActionSheetWithOptions>[0];

/** Every sheet the code opened; each is answered with `answer`. */
function answerSheets(answer: number): SheetOptions[] {
  const opened: SheetOptions[] = [];
  jest.spyOn(ActionSheetIOS, 'showActionSheetWithOptions').mockImplementation((options, done) => {
    opened.push(options);
    done(answer);
  });
  return opened;
}

describe('DEBUG_SHEETS', () => {
  it('offers the labels and Cancel, and reports the chosen label', () => {
    const opened = answerSheets(1);
    const onChoice = jest.fn();

    DEBUG_SHEETS.choose('Set date', ['Real calendar', 'Tomorrow'], onChoice);

    expect(opened).toStrictEqual([
      { title: 'Set date', options: ['Real calendar', 'Tomorrow', 'Cancel'], cancelButtonIndex: 2 },
    ]);
    expect(onChoice).toHaveBeenCalledWith(1);
  });

  it('does nothing on Cancel', () => {
    answerSheets(2);
    const onChoice = jest.fn();

    DEBUG_SHEETS.choose('Set date', ['Real calendar', 'Tomorrow'], onChoice);

    expect(onChoice).not.toHaveBeenCalled();
  });

  it('shows text as the message of a sheet with one Close button', () => {
    const opened = answerSheets(0);

    DEBUG_SHEETS.show('Error log', 'No errors recorded.');

    expect(opened).toStrictEqual([
      {
        title: 'Error log',
        message: 'No errors recorded.',
        options: ['Close'],
        cancelButtonIndex: 0,
      },
    ]);
  });

  it('hands the text to the share sheet', async () => {
    const share = jest
      .spyOn(Share, 'share')
      .mockResolvedValue({ action: 'sharedAction', activityType: undefined });

    await DEBUG_SHEETS.share('{"schemaVersion":1}');

    expect(share).toHaveBeenCalledWith({ message: '{"schemaVersion":1}' });
  });
});
