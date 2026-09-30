// a template that imports an SDK outside its adapter on purpose
import { openDatabaseSync } from 'expo-sqlite';

export const DB = openDatabaseSync('x.db');
