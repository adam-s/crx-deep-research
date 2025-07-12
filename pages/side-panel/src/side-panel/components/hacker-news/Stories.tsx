import React from 'react';
import { makeStyles, Text, Link } from '@fluentui/react-components';
import { DarkScrollContainer } from '../common/DarkScrollContainer';

interface Story {
  title: string;
  url: string;
  author: string;
  points: number;
  num_comments: number;
  story_id: number;
  created_at: string;
}

interface StoriesProps {
  stories: Story[];
}

const useStyles = makeStyles({
  list: {
    margin: 0,
    padding: 0,
    listStyle: 'none',
    width: '100%',
    maxHeight: '100%',
    overflowY: 'auto',
    color: '#f3f3f3',
    background: 'transparent',
  },
  item: {
    padding: '12px 0',
    borderBottom: '1px solid #333',
    display: 'flex',
    flexDirection: 'column',
    gap: '2px',
  },
  title: {
    fontWeight: 600,
    fontSize: '1rem',
    marginBottom: '2px',
    color: '#fff',
    textDecoration: 'none',
    transition: 'color 0.2s',
    ':hover': {
      color: '#e0e0e0',
      textDecoration: 'underline',
    },
    ':active': {
      color: '#cccccc',
    },
    ':visited': {
      color: '#fafafa',
    },
    ':focus': {
      color: '#fff',
      outline: '2px solid #fff',
    },
  },
  meta: {
    color: '#b0b0b0',
    fontSize: '0.85rem',
    display: 'flex',
    gap: '16px',
    flexWrap: 'wrap',
  },
});

export const Stories: React.FC<StoriesProps> = ({ stories }) => {
  const styles = useStyles();

  if (!stories || stories.length === 0) {
    return <Text>No stories found.</Text>;
  }

  return (
    <DarkScrollContainer style={{ height: '100%' }}>
      <ul className={styles.list}>
        {stories.map(story => (
          <li key={story.story_id} className={styles.item}>
            <Link href={story.url} target="_blank" rel="noopener noreferrer" className={styles.title}>
              {story.title}
            </Link>
            <div className={styles.meta}>
              <span>by {story.author}</span>
              <span>{story.points} points</span>
              <span>{story.num_comments} comments</span>
              <span>{new Date(story.created_at).toLocaleDateString()}</span>
            </div>
          </li>
        ))}
      </ul>
    </DarkScrollContainer>
  );
};
