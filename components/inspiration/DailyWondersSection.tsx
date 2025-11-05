import React from 'react';
import InspirationCard, { InspirationItem } from './InspirationCard';

type Props = {
  item: InspirationItem;
};

export default function DailyWondersSection({ item }: Props) {
  return (
    <div>
      <InspirationCard item={item} />
    </div>
  );
}
