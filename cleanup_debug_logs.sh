#!/bin/bash

# Script to remove debug console.log statements with ####### pattern
# This script removes console.log statements that contain "#######" and span multiple lines

set -e

# Function to process a single file
cleanup_file() {
    local file="$1"
    local temp_file=$(mktemp)
    
    echo "Processing: $file"
    
    # Use sed to remove the multi-line console.log patterns
    # This handles the pattern:
    # console.log(
    #   `[some text] ####### some text #######`,
    # );
    
    # First, let's use perl for better multi-line handling
    perl -0pe '
        # Remove console.log statements that contain ##### or #######
        s/console\.log\(\s*\n\s*`[^`]*#{5,7}[^`]*`,\s*\n\s*\);\s*\n?//gs;
        
        # Also handle single line versions with ##### or #######
        s/[ \t]*console\.log\([^)]*#{5,7}[^)]*\);\s*\n?//g;
        
        # Handle single line with backticks
        s/[ \t]*console\.log\(`[^`]*#{5,7}[^`]*`\);\s*\n?//g;
    ' "$file" > "$temp_file"
    
    # Check if changes were made
    if ! cmp -s "$file" "$temp_file"; then
        # Backup original file
        cp "$file" "$file.backup"
        mv "$temp_file" "$file"
        echo "  ✅ Cleaned up debug logs in $file"
    else
        rm "$temp_file"
        echo "  ℹ️  No debug logs found in $file"
    fi
}

# Function to restore backups
restore_backups() {
    echo "Restoring backup files..."
    find . -name "*.backup" -type f | while read -r backup; do
        original="${backup%.backup}"
        mv "$backup" "$original"
        echo "  Restored: $original"
    done
}

# Function to remove backups
remove_backups() {
    echo "Removing backup files..."
    find . -name "*.backup" -type f -delete
    echo "  ✅ All backup files removed"
}

# Show usage
show_usage() {
    echo "Usage: $0 [OPTIONS] [FILES...]"
    echo ""
    echo "Remove debug console.log statements containing '#######' pattern"
    echo ""
    echo "Options:"
    echo "  -h, --help        Show this help message"
    echo "  -r, --restore     Restore files from .backup copies"
    echo "  --remove-backups  Remove all .backup files"
    echo "  --dry-run         Show what would be changed without modifying files"
    echo ""
    echo "Examples:"
    echo "  $0 src/**/*.ts                    # Clean specific TypeScript files"
    echo "  $0 \$(find . -name '*.ts')         # Clean all TypeScript files"
    echo "  $0 --dry-run src/**/*.ts          # Preview changes"
    echo "  $0 --restore                      # Restore from backups"
    echo ""
    echo "If no files are specified, it will process all .ts files in common directories"
}

# Parse command line arguments
DRY_RUN=false
RESTORE=false
REMOVE_BACKUPS=false
FILES=()

while [[ $# -gt 0 ]]; do
    case $1 in
        -h|--help)
            show_usage
            exit 0
            ;;
        -r|--restore)
            RESTORE=true
            shift
            ;;
        --remove-backups)
            REMOVE_BACKUPS=true
            shift
            ;;
        --dry-run)
            DRY_RUN=true
            shift
            ;;
        -*)
            echo "Unknown option: $1"
            show_usage
            exit 1
            ;;
        *)
            FILES+=("$1")
            shift
            ;;
    esac
done

# Handle special modes
if [[ "$RESTORE" == true ]]; then
    restore_backups
    exit 0
fi

if [[ "$REMOVE_BACKUPS" == true ]]; then
    remove_backups
    exit 0
fi

# If no files specified, find common TypeScript files
if [[ ${#FILES[@]} -eq 0 ]]; then
    echo "No files specified. Searching for TypeScript files..."
    
    # Find TypeScript files in common directories
    FILES=()
    while IFS= read -r file; do
        [[ -n "$file" ]] && FILES+=("$file")
    done < <(find . -type f -name "*.ts" \
        \( -path "./pages/*" -o \
           -path "./packages/*" -o \
           -path "./chrome-extension/*" \) \
        -not -path "*/node_modules/*" \
        2>/dev/null | head -50)
    
    if [[ ${#FILES[@]} -eq 0 ]]; then
        echo "No TypeScript files found. Please specify files explicitly."
        exit 1
    fi
    
    echo "Found ${#FILES[@]} TypeScript files to process"
fi

# Dry run mode
if [[ "$DRY_RUN" == true ]]; then
    echo "DRY RUN MODE - No files will be modified"
    echo ""
    
    for file in "${FILES[@]}"; do
        if [[ -f "$file" ]]; then
            # Check if file contains the pattern
            if grep -E "console\.log.*#{5,7}" "$file" &>/dev/null; then
                echo "📋 Would clean: $file"
                echo "   Found debug log patterns:"
                grep -nE "console\.log.*#{5,7}" "$file" | head -3 | sed 's/^/     /'
            fi
        fi
    done
    exit 0
fi

# Main processing
echo "Starting cleanup of debug console.log statements..."
echo "Processing ${#FILES[@]} files..."
echo ""

processed=0
cleaned=0

for file in "${FILES[@]}"; do
    if [[ -f "$file" ]]; then
        # Check if file contains the pattern before processing
        if grep -E "console\.log.*#{5,7}" "$file" &>/dev/null; then
            cleanup_file "$file"
            ((cleaned++))
        else
            echo "Processing: $file"
            echo "  ℹ️  No debug logs found in $file"
        fi
        ((processed++))
    else
        echo "⚠️  File not found: $file"
    fi
done

echo ""
echo "✅ Cleanup complete!"
echo "   Files processed: $processed"
echo "   Files cleaned: $cleaned"
echo ""
echo "💡 Backup files (.backup) have been created for all modified files"
echo "   Use '$0 --restore' to restore original files"
echo "   Use '$0 --remove-backups' to remove backup files"
