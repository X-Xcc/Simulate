import torch
import torch 
from torchvision.models import resent50
from torch.utils.data import DataLoader

base_model = resent50(pretrained=True)

num_features = base_model.fc.in_features
base_model.fc = nn.Linear(num_features, 2)

critertion = nn.BCEWithLogitsLoss()
optimizer = torch.optim.Adam(base_model.parameters(), lr=0.01)

device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
model = base_model.to(device)

for epoch in range(50):
    model.train()
    epoch_loss = 0.0

    for images,labels in dataloader:
        optimizer.zero_grad()

        outputs = models(images.to(device))
        loss = critertion(outputs,labels.to(device))

        loss.backward()
        optimizer.step()
        epoch_loss += loss.item()

        current_loss = epoch_loss / len(dataloader)
        current_mAP = evaluate_mAP(model,validation_data)
        print(f"Epoch {epoch+1}/50 | Loss: {current_loss:.4f} | mAP@.5:{currrent_mAP:.4f}")