import os
import pandas as pd
from database import SessionLocal
from models import LandPrice

def import_prices(file_path):
    # Đọc tất cả các sheet trong file Excel
    excel_file = pd.ExcelFile(file_path)
    print(f"📁 Các sheet có trong file Excel: {excel_file.sheet_names}")
    
    db = SessionLocal()
    total_count = 0
    
    try:
        for sheet_name in excel_file.sheet_names:
            print(f"\n--- Đang kiểm tra Sheet: '{sheet_name}' ---")
            df_raw = pd.read_excel(file_path, header=None, sheet_name=sheet_name)
            print(f"Số dòng trong sheet này: {len(df_raw)}")
            
            # Tìm dòng chứa tiêu đề 'id' hoặc 'Duong' để bắt đầu lấy dữ liệu
            start_row = -1
            for idx, row in df_raw.iterrows():
                row_str = str(row.values).lower()
                if 'id' in row_str or 'duong' in row_str or 'maphuong' in row_str:
                    start_row = idx + 1 # Bắt đầu lấy từ dòng ngay sau dòng tiêu đề
                    print(f"👉 Tìm thấy tiêu đề tại dòng index {idx}, bắt đầu đọc dữ liệu từ dòng {start_row}")
                    break
            
            if start_row == -1:
                print(f"⚠️ Không tìm thấy dòng tiêu đề hợp lệ trong sheet '{sheet_name}', bỏ qua.")
                continue
                
            count = 0
            for index in range(start_row, len(df_raw)):
                row = df_raw.iloc[index]
                id_val = row.iloc[0]
                
                # Bỏ qua dòng trống hoặc dòng lỗi công thức
                if pd.isna(id_val) or str(id_val).strip() in ['', '#REF!', 'STT', 'nan']:
                    continue
                    
                def clean_money(val):
                    if pd.isna(val):
                        return 0.0
                    val_str = str(val).replace('.', '').replace(',', '').strip()
                    try:
                        return float(val_str)
                    except:
                        return 0.0

                record_id = str(id_val).strip()
                ma_phuong = str(row.iloc[1]).strip() if not pd.isna(row.iloc[1]) else ''
                duong = str(row.iloc[2]).strip() if not pd.isna(row.iloc[2]) else ''
                dat_o = clean_money(row.iloc[3])
                dat_tmdv = clean_money(row.iloc[4])
                dat_sxpnn = clean_money(row.iloc[5])
                
                existing = db.query(LandPrice).filter(LandPrice.id == record_id).first()
                if existing:
                    existing.ma_phuong = ma_phuong
                    existing.duong = duong
                    existing.dat_o = dat_o
                    existing.dat_tmdv = dat_tmdv
                    existing.dat_sxpnn = dat_sxpnn
                else:
                    new_item = LandPrice(
                        id=record_id,
                        ma_phuong=ma_phuong,
                        duong=duong,
                        dat_o=dat_o,
                        dat_tmdv=dat_tmdv,
                        dat_sxpnn=dat_sxpnn
                    )
                    db.add(new_item)
                count += 1
            
            total_count += count
            print(f"✅ Đã import thành công {count} bản ghi từ sheet '{sheet_name}'")
            
        db.commit()
        print(f"\n🎉 Tổng cộng đã đưa thành công {total_count} bản ghi vào MySQL!")
    except Exception as e:
        db.rollback()
        print(f"❌ Lỗi khi lưu database: {e}")
    finally:
        db.close()

if __name__ == "__main__":
    files = [f for f in os.listdir('.') if f.endswith('.xlsx') and not f.startswith('~$')]
    if files:
        file_path = files[0]
        print(f"Đang xử lý file: {file_path}")
        import_prices(file_path)
    else:
        print("❌ Không tìm thấy file Excel nào trong thư mục!")