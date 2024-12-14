import os
import datetime

def collect_code():
    # Директории для сканирования
    directories_to_scan = [
        'client/src/components',
        'client/src/context',
        'server/src/handlers',
        'server'
    ]

    # Фиксированное имя файла
    output_file = 'code_snapshot.txt'
    
    # Базовая директория проекта
    base_dir = os.path.dirname(os.path.abspath(__file__))
    
    try:
        with open(output_file, 'w', encoding='utf-8') as outfile:
            # Записываем заголовок
            outfile.write(f"Code Snapshot - {datetime.datetime.now()}\n")
            outfile.write("=" * 80 + "\n\n")
            
            # Обрабатываем каждую директорию
            for dir_path in directories_to_scan:
                full_dir_path = os.path.join(base_dir, dir_path)
                if os.path.exists(full_dir_path):
                    outfile.write(f"\nDirectory: {dir_path}\n")
                    outfile.write("=" * 80 + "\n\n")
                    
                    # Собираем все файлы в директории
                    for root, dirs, files in os.walk(full_dir_path):
                        for file in files:
                            if file.endswith(('.js', '.jsx')):  # только JavaScript файлы
                                file_path = os.path.join(root, file)
                                relative_path = os.path.relpath(file_path, base_dir)
                                
                                # Записываем заголовок файла
                                outfile.write(f"\nFile: {relative_path}\n")
                                outfile.write("-" * 80 + "\n\n")
                                
                                # Читаем и записываем содержимое файла
                                try:
                                    with open(file_path, 'r', encoding='utf-8') as infile:
                                        content = infile.read()
                                        outfile.write(content)
                                        outfile.write("\n\n")
                                except Exception as e:
                                    outfile.write(f"Error reading file: {str(e)}\n")
                else:
                    outfile.write(f"\nDirectory not found: {dir_path}\n")
            
            outfile.write("\nEnd of Code Snapshot\n")
            outfile.write("=" * 80 + "\n")
        
        print(f"Code snapshot has been saved to: {output_file}")
        
    except Exception as e:
        print(f"Error creating code snapshot: {str(e)}")

if __name__ == "__main__":
    collect_code()
